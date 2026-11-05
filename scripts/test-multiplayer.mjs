import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'tests/multiplayer');
const tests = (await readdir(directory)).filter((file) => file.endsWith('.test.mjs')).sort().map((file) => join(directory, file));
if (!tests.length) throw new Error('No multiplayer regression tests found.');
const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
