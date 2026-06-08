import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { packageRelease } from '../scripts/package-release.mjs';

async function writeFile(targetPath, content) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
}

test('packageRelease builds an isolated release snapshot and current symlink', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-release-project-'));
  const deployRoot = path.join(projectRoot, '.deploy-test');

  await writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    name: 'todo-release-fixture',
    version: '1.4.0',
    dependencies: {
      leftpad: '1.0.0'
    }
  }, null, 2));
  await writeFile(path.join(projectRoot, 'README.md'), '# fixture\n');
  await writeFile(path.join(projectRoot, 'server.js'), 'console.log("fixture");\n');
  await writeFile(path.join(projectRoot, 'public', 'index.html'), '<!doctype html>\n');
  await writeFile(path.join(projectRoot, 'src', 'storage.js'), 'export const ok = true;\n');
  await writeFile(path.join(projectRoot, 'assets', 'todo-app.css'), 'body{}\n');
  await writeFile(path.join(projectRoot, 'design', 'index.html'), '<main>prototype</main>\n');
  await writeFile(path.join(projectRoot, 'node_modules', 'leftpad', 'index.js'), 'module.exports = value => value;\n');

  const result = await packageRelease({
    projectRoot,
    deployRoot,
    now: new Date('2026-06-08T06:07:08+08:00')
  });

  assert.equal(result.releaseName, 'v1.4.0-20260608-060708');
  assert.equal(await fs.readFile(path.join(result.releaseDir, 'server.js'), 'utf8'), 'console.log("fixture");\n');
  assert.equal(await fs.readFile(path.join(result.releaseDir, 'public', 'index.html'), 'utf8'), '<!doctype html>\n');
  assert.equal(await fs.readFile(path.join(result.releaseDir, 'node_modules', 'leftpad', 'index.js'), 'utf8'), 'module.exports = value => value;\n');

  const currentStat = await fs.lstat(result.currentLink);
  assert.equal(currentStat.isSymbolicLink(), true);
  const currentTarget = await fs.readlink(result.currentLink);
  assert.equal(path.resolve(deployRoot, currentTarget), result.releaseDir);

  const metadata = JSON.parse(await fs.readFile(path.join(result.releaseDir, 'RELEASE.json'), 'utf8'));
  assert.equal(metadata.version, '1.4.0');
  assert.equal(metadata.sharedDataDir, path.join(projectRoot, 'data'));
  assert.equal(metadata.sharedLogsDir, path.join(deployRoot, 'shared', 'logs'));
  assert.deepEqual(metadata.copiedEntries, [
    'server.js',
    'package.json',
    'README.md',
    'src',
    'public',
    'assets',
    'design',
    'node_modules'
  ]);
});
