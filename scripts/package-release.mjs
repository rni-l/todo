import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(scriptDir, '..');
const runtimeEntries = [
  'server.js',
  'package.json',
  'README.md',
  'src',
  'public',
  'assets',
  'design'
];
const optionalEntries = ['package-lock.json'];

function formatTimestamp(input) {
  const date = input instanceof Date ? input : new Date(input);
  const pad = value => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function removePath(targetPath) {
  try {
    const stat = await fs.lstat(targetPath);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    }
    await fs.unlink(targetPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function readPackageJson(projectRoot) {
  const packagePath = path.join(projectRoot, 'package.json');
  return JSON.parse(await fs.readFile(packagePath, 'utf8'));
}

function hasRuntimeDependencies(packageJson) {
  return Object.keys(packageJson.dependencies || {}).length > 0
    || Object.keys(packageJson.optionalDependencies || {}).length > 0;
}

async function copyEntry(projectRoot, releaseDir, entry) {
  const source = path.join(projectRoot, entry);
  if (!await exists(source)) return false;
  const target = path.join(releaseDir, entry);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
  return true;
}

async function switchCurrentRelease(deployRoot, releaseDir) {
  const currentLink = path.join(deployRoot, 'current');
  const tempLink = path.join(deployRoot, `.current-${process.pid}-${Date.now()}`);
  const relativeTarget = path.relative(deployRoot, releaseDir) || '.';
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';

  await removePath(tempLink);
  await fs.symlink(relativeTarget, tempLink, linkType);
  await removePath(currentLink);
  await fs.rename(tempLink, currentLink);
  return currentLink;
}

export async function packageRelease({
  projectRoot = defaultProjectRoot,
  deployRoot = path.join(projectRoot, '.deploy'),
  now = new Date(),
  releaseName,
  sharedDataDir,
  sharedLogsDir
} = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedDeployRoot = path.resolve(deployRoot);
  const packageJson = await readPackageJson(resolvedProjectRoot);
  const version = packageJson.version || '0.0.0';
  const finalReleaseName = releaseName || `v${version}-${formatTimestamp(now)}`;
  const releaseDir = path.join(resolvedDeployRoot, 'releases', finalReleaseName);
  const finalSharedDataDir = path.resolve(sharedDataDir || path.join(resolvedProjectRoot, 'data'));
  const finalSharedLogsDir = path.resolve(sharedLogsDir || path.join(resolvedDeployRoot, 'shared', 'logs'));

  if (await exists(releaseDir)) {
    throw new Error(`Release already exists: ${releaseDir}`);
  }

  await fs.mkdir(releaseDir, { recursive: true });
  await fs.mkdir(finalSharedDataDir, { recursive: true });
  await fs.mkdir(finalSharedLogsDir, { recursive: true });

  const copiedEntries = [];
  for (const entry of runtimeEntries) {
    if (await copyEntry(resolvedProjectRoot, releaseDir, entry)) copiedEntries.push(entry);
  }
  for (const entry of optionalEntries) {
    if (await copyEntry(resolvedProjectRoot, releaseDir, entry)) copiedEntries.push(entry);
  }
  if (hasRuntimeDependencies(packageJson) && await exists(path.join(resolvedProjectRoot, 'node_modules'))) {
    if (await copyEntry(resolvedProjectRoot, releaseDir, 'node_modules')) copiedEntries.push('node_modules');
  }

  const metadata = {
    version,
    releaseName: finalReleaseName,
    createdAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    projectRoot: resolvedProjectRoot,
    releaseDir,
    sharedDataDir: finalSharedDataDir,
    sharedLogsDir: finalSharedLogsDir,
    copiedEntries
  };

  await fs.writeFile(
    path.join(releaseDir, 'RELEASE.json'),
    `${JSON.stringify(metadata, null, 2)}\n`
  );

  const currentLink = await switchCurrentRelease(resolvedDeployRoot, releaseDir);
  return {
    ...metadata,
    currentLink
  };
}

function printSummary(result) {
  console.log(`Release ready: ${result.releaseName}`);
  console.log(`Version: ${result.version}`);
  console.log(`Release directory: ${result.releaseDir}`);
  console.log(`Current release link: ${result.currentLink}`);
  console.log(`Shared data directory: ${result.sharedDataDir}`);
  console.log(`Shared logs directory: ${result.sharedLogsDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await packageRelease();
  printSummary(result);
}
