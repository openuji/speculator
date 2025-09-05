#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Delegate to compiled CLI module
import { exportAssertions as doExportAssertions } from '../dist/cli/export-assertions.js';

function printUsage() {
  const help = `
speculator <command> [options]

Commands:
  export:assertion     Export RFC2119 assertions to JSON

export:assertion options:
  --input <path>         Path to an index.spec.html (alternative to --spec/--version)
  --spec <shortname>     Spec shortname (e.g., ujse)
  --version <version>    Version (e.g., 1.0 or 1.0-draft)
  --spec-dir <dir>       Root directory containing product specs (default: env SPEC_DIR or ./spec)
  --base <url>           Base URL used to build assertion URLs (e.g., https://spec.openuji.dev/ujse/1.0/)
  --out <file>           Output file (default: assertions.json)
  --strict               Exit non-zero if multiple keywords found in a block
  --help                 Show help
`;
  process.stdout.write(help);
}

function parseArgs(argv) {
  const args = {};
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

async function exportAssertions(rest) {
  const args = parseArgs(rest);
  if (args.help) {
    printUsage();
    process.exit(0);
  }
  const { exitCode } = await doExportAssertions(rest);
  process.exit(exitCode);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === '--help' || cmd === 'help') {
    printUsage();
    process.exit(0);
  }
  if (cmd === 'export:assertion' || cmd === 'export:assertions') {
    await exportAssertions(rest);
    return;
  }
  process.stderr.write(`Unknown command: ${cmd}\n\n`);
  printUsage();
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
