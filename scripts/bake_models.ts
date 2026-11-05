import path from 'node:path';
import fs from 'node:fs/promises';
import { bakeMainFigures } from './bake_figures.ts';
import { bakeArhats } from './bake_arhats.ts';
import { validateFigureDirectory } from './figures/validate.ts';

const releaseRoot = path.resolve('outputs/model-art-refactor');
await fs.mkdir(releaseRoot, { recursive: true });
const stage = await fs.mkdtemp(path.join(releaseRoot, 'staging-'));
await bakeMainFigures(stage);
await bakeArhats(stage);
const report = await validateFigureDirectory(stage);
await fs.writeFile(path.join(releaseRoot, 'asset-validation.json'), JSON.stringify(report, null, 2));
if (!report.passed) {
  for (const asset of report.assets) if (asset.errors.length) console.error(asset.id, asset.lod, asset.errors.join('; '));
  throw new Error(`Staged assets failed validation; live assets preserved. Inspect ${stage}`);
}
const target = path.resolve('public/models/figures');
const previous = path.join(releaseRoot, `previous-${Date.now()}`);
await fs.rename(target, previous);
try { await fs.rename(stage, target); }
catch (error) { await fs.rename(previous, target); throw error; }
console.log(`Published 42 validated GLBs. Previous release: ${previous}`);
