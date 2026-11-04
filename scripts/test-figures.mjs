import { build } from 'esbuild';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testRoot = join(root, 'tests/figures');
const entries = (await readdir(testRoot)).filter((name) => name.endsWith('.test.ts')).sort();
if (!entries.length) throw new Error('No figure regression tests found.');
const output = await mkdtemp(join(tmpdir(), 'chua-figure-tests-'));
try {
  const bundled = [];
  for (const [index, name] of entries.entries()) {
    const outfile = join(output, `${index}.test.mjs`);
    await build({
      absWorkingDir: root,
      entryPoints: [join(testRoot, name)],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      logLevel: 'warning',
    });
    bundled.push(outfile);
  }
  const result = spawnSync(process.execPath, ['--test', ...bundled], { stdio: 'inherit', cwd: root });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(output, { recursive: true, force: true });
}
