import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildThemeTokens } from './build-theme-tokens.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const themesSourceDir = path.resolve(packageDir, 'src/styles/themes');
const generatedDir = path.resolve(packageDir, 'src/styles/generated');

function toConstantName(themeName) {
  return `${themeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_THEME_CSS`;
}

async function loadTailwindNodeApi() {
  const pnpmRoot = path.resolve(packageDir, '..', '..', 'node_modules', '.pnpm');
  if (!existsSync(pnpmRoot)) {
    return null;
  }

  const tailwindEntry = readdirSync(pnpmRoot).find((entry) =>
    entry.startsWith('@tailwindcss+node@')
  );

  const candidate = tailwindEntry
    ? path.join(
        pnpmRoot,
        tailwindEntry,
        'node_modules',
        '@tailwindcss',
        'node',
        'dist',
        'index.mjs'
      )
    : '';

  if (!existsSync(candidate)) {
    return null;
  }

  return import(pathToFileURL(candidate).href);
}

async function getSourceCandidates() {
  const sourceDir = path.resolve(packageDir, 'src');
  const filePaths = [];

  const walk = async (dir) => {
    if (dir.startsWith(path.resolve(sourceDir, 'styles/generated'))) {
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.css')) {
        filePaths.push(fullPath);
      }
    }
  };

  await walk(sourceDir);

  const candidates = new Set();
  for (const filePath of filePaths) {
    const content = await readFile(filePath, 'utf8');
    const words = content.match(/[\w\-:./]+/g) || [];
    for (const word of words) {
      candidates.add(word);
    }
  }

  return Array.from(candidates);
}

async function inlineLocalImports(source, baseDir, seen = new Set()) {
  const importRegex = /@import\s+["']([^"']+)["'];/g;
  let output = '';
  let cursor = 0;

  for (const match of source.matchAll(importRegex)) {
    const fullMatch = match[0];
    const specifier = match[1];
    const start = match.index ?? 0;
    const end = start + fullMatch.length;

    output += source.slice(cursor, start);
    cursor = end;

    if (specifier === 'tailwindcss' || !specifier.startsWith('.')) {
      output += fullMatch;
      continue;
    }

    const resolvedPath = path.resolve(baseDir, specifier);
    if (seen.has(resolvedPath)) {
      continue;
    }
    seen.add(resolvedPath);

    const imported = await readFile(resolvedPath, 'utf8');
    const inlinedImported = await inlineLocalImports(imported, path.dirname(resolvedPath), seen);
    output += `\n${inlinedImported}\n`;
  }

  output += source.slice(cursor);
  return output;
}

function stripTailwindDirectives(source) {
  return source
    .replace(/@import\s+["']tailwindcss["'];\s*/g, '')
    .replace(/@custom-variant[^\n]*\n/g, '')
    .replace(/@theme\s*\{[\s\S]*?\}\s*/g, '')
    .trim();
}

async function compileThemeCss({
  sourcePath,
  source,
  tailwindNode,
  candidates,
}) {
  const canCompile = tailwindNode?.compile && tailwindNode?.optimize;

  if (canCompile) {
    try {
      const compiler = await tailwindNode.compile(source, {
        base: path.dirname(sourcePath),
        from: sourcePath,
        onDependency: () => {},
      });
      const compiledCss = compiler.build(candidates);
      return tailwindNode.optimize(compiledCss, { minify: true }).code;
    } catch {
      // fall through to fallback
    }
  }

  const inlined = await inlineLocalImports(source, path.dirname(sourcePath));
  return stripTailwindDirectives(inlined);
}

async function build() {
  await buildThemeTokens();

  const themeEntries = (await readdir(themesSourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (themeEntries.length === 0) {
    throw new Error(`No theme CSS files found in ${themesSourceDir}`);
  }

  const tailwindNode = await loadTailwindNodeApi();
  const candidates = await getSourceCandidates();
  await mkdir(generatedDir, { recursive: true });

  for (const fileName of themeEntries) {
    const themeName = path.basename(fileName, '.css');
    const sourcePath = path.join(themesSourceDir, fileName);
    const generatedTsPath = path.join(generatedDir, `${themeName}.css.ts`);
    const source = await readFile(sourcePath, 'utf8');
    const optimizedCss = await compileThemeCss({
      sourcePath,
      source,
      tailwindNode,
      candidates,
    });
    const constantName = toConstantName(themeName);
    const fileContents =
      `/* This file is generated by scripts/build-theme-css.mjs. */\n` +
      `export const ${constantName} = ${JSON.stringify(optimizedCss)};\n`;

    await writeFile(generatedTsPath, fileContents, 'utf8');
    process.stdout.write(
      `[solospec] generated ${path.relative(packageDir, generatedTsPath)} (${optimizedCss.length} bytes)\n`
    );
  }
}

build().catch((error) => {
  process.stderr.write(`[solospec] theme css build failed: ${String(error)}\n`);
  process.exitCode = 1;
});
