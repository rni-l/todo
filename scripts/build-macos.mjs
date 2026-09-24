import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = path.join(root, 'app/macos/Generated');
const runtime = path.join(generated, 'Runtime');
const xcode = '/Applications/Xcode.app/Contents/Developer';
const swiftc = path.join(xcode, 'Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc');
const sdk = path.join(xcode, 'Platforms/MacOSX.platform/Developer/SDKs/MacOSX27.sdk');
const buildDir = path.join(root, 'app/macos/build');
const app = path.join(buildDir, 'Build/Products/Debug/TodoMac.app');
const widget = path.join(app, 'Contents/PlugIns/TodoWidget.appex');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      DEVELOPER_DIR: xcode,
      CLANG_MODULE_CACHE_PATH: path.join(buildDir, 'ModuleCache'),
      SWIFT_MODULE_CACHE_PATH: path.join(buildDir, 'ModuleCache')
    },
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed with exit code ${result.status}`);
}

function infoPlist({ executable, identifier, packageType, extension = false }) {
  const extensionBlock = extension
    ? '<key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>'
    : '<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>TodoMac Quick Add</string><key>CFBundleURLSchemes</key><array><string>myselftodo</string></array></dict></array><key>NSHighResolutionCapable</key><true/>';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleDevelopmentRegion</key><string>zh_CN</string><key>CFBundleExecutable</key><string>${executable}</string><key>CFBundleIdentifier</key><string>${identifier}</string><key>CFBundleInfoDictionaryVersion</key><string>6.0</string><key>CFBundleName</key><string>${executable}</string><key>CFBundlePackageType</key><string>${packageType}</string><key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleVersion</key><string>1</string><key>LSMinimumSystemVersion</key><string>14.0</string>${extensionBlock}</dict></plist>\n`;
}

function nodeBinary() {
  const selected = process.env.TODO_MAC_NODE
    || path.join(os.homedir(), '.nvm/versions/node/v22.14.0/bin/node');
  try {
    const version = execFileSync(selected, ['--version'], { encoding: 'utf8' }).trim();
    if (Number(version.slice(1).split('.')[0]) < 20) throw new Error('Node 20+ is required');
    const deps = execFileSync('otool', ['-L', selected], { encoding: 'utf8' });
    if (deps.includes('/opt/homebrew/') || deps.includes('/usr/local/')) {
      throw new Error('Use a standalone Node binary, not a Homebrew-linked executable');
    }
    return selected;
  } catch (error) {
    throw new Error(`Set TODO_MAC_NODE to a standalone macOS arm64 Node 20+ binary: ${error.message}`);
  }
}

await fs.rm(generated, { recursive: true, force: true });
await fs.mkdir(runtime, { recursive: true });
for (const entry of ['server.js', 'package.json', 'src', 'public']) {
  await fs.cp(path.join(root, entry), path.join(runtime, entry), { recursive: true });
}
await fs.copyFile(nodeBinary(), path.join(generated, 'node'));
await fs.chmod(path.join(generated, 'node'), 0o755);
await fs.writeFile(path.join(generated, 'QuickAccess.json'), JSON.stringify({
  token: crypto.randomBytes(32).toString('hex')
}));

await fs.rm(app, { recursive: true, force: true });
await fs.mkdir(path.join(app, 'Contents/MacOS'), { recursive: true });
await fs.mkdir(path.join(app, 'Contents/Resources'), { recursive: true });
await fs.mkdir(path.join(widget, 'Contents/MacOS'), { recursive: true });
await fs.mkdir(path.join(widget, 'Contents/Resources'), { recursive: true });

const shared = [
  'app/macos/Shared/QuickClient.swift',
  'app/macos/Shared/CompleteTaskIntent.swift'
];
const compile = (name, sources, destination) => run(swiftc, [
  '-sdk', sdk,
  '-target', 'arm64-apple-macosx14.0',
  '-module-name', name,
  '-module-cache-path', path.join(buildDir, 'ModuleCache'),
  ...sources.map(source => path.join(root, source)),
  '-o', destination
]);
compile('TodoWidget', [...shared, 'app/macos/Widget/TodoWidget.swift'], path.join(widget, 'Contents/MacOS/TodoWidget'));
compile('TodoMac', [...shared, 'app/macos/App/RuntimeController.swift', 'app/macos/App/TodoMacApp.swift'], path.join(app, 'Contents/MacOS/TodoMac'));

await fs.writeFile(path.join(app, 'Contents/Info.plist'), infoPlist({ executable: 'TodoMac', identifier: 'com.ddd.personaltodo.mac', packageType: 'APPL' }));
await fs.writeFile(path.join(widget, 'Contents/Info.plist'), infoPlist({ executable: 'TodoWidget', identifier: 'com.ddd.personaltodo.mac.widget', packageType: 'XPC!', extension: true }));
await fs.cp(runtime, path.join(app, 'Contents/Resources/Runtime'), { recursive: true });
await fs.copyFile(path.join(generated, 'node'), path.join(app, 'Contents/Resources/node'));
await fs.chmod(path.join(app, 'Contents/Resources/node'), 0o755);
await fs.copyFile(path.join(generated, 'QuickAccess.json'), path.join(app, 'Contents/Resources/QuickAccess.json'));
await fs.copyFile(path.join(generated, 'QuickAccess.json'), path.join(widget, 'Contents/Resources/QuickAccess.json'));

run('/usr/bin/codesign', ['--force', '--sign', '-', path.join(app, 'Contents/Resources/node')]);
run('/usr/bin/codesign', ['--force', '--sign', '-', '--entitlements', path.join(root, 'app/macos/Widget/TodoWidget.entitlements'), widget]);
run('/usr/bin/codesign', ['--force', '--sign', '-', app]);
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
console.log(`Built ${app}`);
