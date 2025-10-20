import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Speculator, LinkedomHtmlRenderer } from '../node';
import type { PostProcessHook, AssertionsOptions, OutputArea } from '../types';

export interface CliIO {
  readFile?: (p: string, enc?: BufferEncoding) => Promise<string>;
  writeFile?: (p: string, data: string, enc?: BufferEncoding) => Promise<void>;
  stat?: (p: string) => Promise<{ isFile(): boolean }>;
  env?: Record<string, string | undefined>;
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}

export interface ExportResultItem {
  id: string;
  url: string;
  type: 'MUST' | 'MUST NOT' | 'SHOULD' | 'MAY';
}

export interface ExportAssertionsResult {
  exitCode: number;
  outPath?: string;
  items?: ExportResultItem[];
  warnings: string[];
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (key === 'strict' || key === 'help') {
      args[key] = true;
    } else if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export async function exportAssertions(
  argv: string[],
  io: CliIO = {},
): Promise<ExportAssertionsResult> {
  const warnings: string[] = [];
  const readFile = io.readFile || (p => fs.readFile(p, 'utf8'));
  const writeFile = io.writeFile || ((p, d) => fs.writeFile(p, d, 'utf8'));
  const stat = io.stat || (p => fs.stat(p));
  const env = io.env || process.env;
  const log = io.log || ((m: string) => console.log(m));
  const warn = io.warn || ((m: string) => console.warn(m));
  const error = io.error || ((m: string) => console.error(m));

  const args = parseArgs(argv);
  if (args.help) {
    log('Usage: speculator export:assertion [--input path|--spec <s> --version <v>] [--spec-dir dir] [--base url] [--out file] [--strict]');
    return { exitCode: 0, warnings };
  }

  let input = args.input as string | undefined;
  let spec = args.spec as string | undefined;
  let version = args.version as string | undefined;
  const strict = !!args.strict;
  const specDir = (args['spec-dir'] as string | undefined) || env.SPEC_DIR || path.resolve(process.cwd(), 'spec');

  if (!input) {
    if (!spec || !version) {
      error('Either --input or both --spec and --version are required.');
      return { exitCode: 1, warnings };
    }
    input = path.join(specDir, spec, version, 'index.spec.html');
  }

  const exists = await stat(input).then(s => s.isFile()).catch(() => false);
  if (!exists) {
    error(`Input not found: ${input}`);
    return { exitCode: 1, warnings };
  }

  // Infer spec/version from the input path if not supplied
  try {
    if (!spec || !version) {
      const parts = path.normalize(input).split(path.sep).filter(Boolean);
      if (parts.length >= 3) {
        spec = parts[parts.length - 3];
        version = parts[parts.length - 2];
      }
    }
  } catch {}

  const baseUrl = new URL('./', pathToFileURL(input)).toString();
  const html = await readFile(input, 'utf8');

  const assertions: AssertionsOptions = {};
  if (spec) assertions.spec = spec;
  if (version) assertions.version = version;
  const speculator = new Speculator({ baseUrl, postprocess: { assertions } });

  let captured: any[] = [];
  const hook: PostProcessHook = (_container, outs) => {
    const items = outs['assertions'] as any[] | undefined;
    if (Array.isArray(items)) captured = items;
  };

  // Parse into sections and call renderDocument so hooks are honored
  const htmlRenderer = new LinkedomHtmlRenderer();
  const container = htmlRenderer.parse(html);
  const sections = Array.from(container.children) as Element[];
  const areas: OutputArea[] = ['assertions'];
  const res = await speculator.renderDocument({ sections, postProcess: hook }, areas);
  warnings.push(...res.warnings);

  const base = (args.base as string | undefined) || (spec && version ? `https://spec.openuji.dev/${spec}/${version}/` : '');
  const outPath = (args.out as string | undefined) || 'assertions.json';
  const items: ExportResultItem[] = captured.map(it => ({
    id: it.id, 
    url: base ? `${base}#${it.anchorId}` : `#${it.anchorId}`,
    type: it.type,
    snippet: it.snippet,
   }));
  await writeFile(outPath, JSON.stringify(items, null, 2) + '\n', 'utf8');

  const multiWarnings = warnings.filter(w => /Multiple normative keywords/.test(w));
  if (multiWarnings.length) {
    warn(`Found ${multiWarnings.length} blocks with multiple normative keywords:`);
    for (const w of multiWarnings) warn(' - ' + w);
    if (strict) return { exitCode: 2, outPath, items, warnings };
  }

  log(`Wrote ${items.length} assertions to ${outPath}`);
  return { exitCode: 0, outPath, items, warnings };
}
