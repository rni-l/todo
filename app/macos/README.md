# macOS 桌面版

这是现有个人 TODO 的本机 macOS 外壳。主窗口复用 React 网页，菜单栏和桌面小组件由 SwiftUI 与 WidgetKit 实现；所有入口通过应用自带的 Node 服务读写同一个 `data/todo-data.json`。现有网页服务可继续使用该目录，`TodoStoreRuntime` 会协调跨进程写入。

## 构建

本机需要 macOS、Xcode 和独立发行的 arm64 Node 20+。当前构建脚本默认使用 `~/.nvm/versions/node/v22.14.0/bin/node`；如需更换，设置 `TODO_MAC_NODE`。Homebrew 的 Node 依赖额外动态库，不能直接放进独立应用包。

```bash
npm run build:mac
```

输出位于 `app/macos/build/Build/Products/Debug/TodoMac.app`。构建使用 Xcode 自带 Swift 编译器，并为应用、Node 和小组件扩展做“Sign to Run Locally”临时签名；不需要 Apple 开发者账号。仓库也包含 `TodoMac.xcodeproj`，可在 Xcode 正常工作时打开。当前机器的 `xcodebuild` 加载 CoreDevice 失败，因此脚本直接调用同一套 Swift 编译器组装应用。

## 使用

1. 打开 `.app`，选择包含 `todo-data.json` 的现有 `data` 目录。
2. 在主窗口用现有账号密码登录。登录后菜单栏和小组件才会获得本机快捷操作权限。
3. 从系统小组件面板添加“今日任务”。小组件显示今日和逾期任务，可直接完成；点“＋”会打开主窗口添加任务。
4. 关闭主窗口后，菜单栏和服务继续运行；从菜单栏选择“退出应用”才会停止服务。

应用仅在 `127.0.0.1:38889` 监听。菜单栏支持查看、添加今天任务和完成任务。小组件在服务停止时保留最近一次成功读取的内容，并标注为旧数据；系统决定小组件的定时刷新时机。构建时生成的快捷入口密钥放在应用和扩展各自的资源包里，每次重新构建后需在主窗口重新登录一次。

本机临时签名适合这台 Mac 的开发与自用；换机器安装以及正式分发需要另行处理签名。若系统小组件面板未出现“今日任务”，先确认应用已启动，再运行 `pluginkit -m -i com.ddd.personaltodo.mac.widget` 检查扩展是否被系统登记。
