import AppKit
import Combine
import Foundation
import WidgetKit

@MainActor
final class RuntimeController: ObservableObject {
    static let shared = RuntimeController()

    @Published private(set) var ready = false
    @Published private(set) var status = "请选择任务数据目录"
    @Published private(set) var dataDirectory: URL?
    @Published var quickAddRequest = 0
    @Published var refreshRequest = 0

    private var server: Process?
    private let folderKey = "TodoMacDataDirectory"

    private init() {}

    func startSavedFolder() {
        guard server == nil else { return }
        guard let path = UserDefaults.standard.string(forKey: folderKey) else { return }
        start(URL(fileURLWithPath: path, isDirectory: true))
    }

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "使用此数据目录"
        panel.message = "选择包含 todo-data.json 的现有 data 文件夹"
        panel.begin { [weak self] result in
            guard result == .OK, let url = panel.url else { return }
            Task { @MainActor in self?.start(url) }
        }
    }

    func start(_ folder: URL) {
        stop()
        let dataFile = folder.appendingPathComponent("todo-data.json")
        guard FileManager.default.fileExists(atPath: dataFile.path) else {
            status = "所选目录没有 todo-data.json，请选择现有 data 文件夹"
            return
        }
        guard let node = Bundle.main.url(forResource: "node", withExtension: nil),
              let runtime = Bundle.main.resourceURL?.appendingPathComponent("Runtime"),
              FileManager.default.fileExists(atPath: runtime.appendingPathComponent("server.js").path),
              let token = try? QuickClient.token() else {
            status = "应用包缺少 Node、网页资源或快捷入口密钥"
            return
        }

        let stateDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TodoMac", isDirectory: true)
        try? FileManager.default.createDirectory(at: stateDir, withIntermediateDirectories: true)

        let process = Process()
        process.executableURL = node
        process.arguments = [runtime.appendingPathComponent("server.js").path]
        process.currentDirectoryURL = runtime
        process.environment = ProcessInfo.processInfo.environment.merging([
            "PORT": "38889",
            "TODO_HOST": "127.0.0.1",
            "TODO_DATA_DIR": folder.path,
            "TODO_MAC_STATE_DIR": stateDir.path,
            "TODO_MAC_WIDGET_TOKEN": token,
            "TODO_MAC_PARENT_PID": String(ProcessInfo.processInfo.processIdentifier)
        ]) { _, new in new }
        let output = Pipe()
        process.standardOutput = output
        process.standardError = output
        output.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if !data.isEmpty, let line = String(data: data, encoding: .utf8) {
                NSLog("TodoMac service: %@", line.trimmingCharacters(in: .whitespacesAndNewlines))
            }
        }
        process.terminationHandler = { [weak self] exited in
            Task { @MainActor in
                guard let self, self.server === exited else { return }
                self.ready = false
                self.status = "本机任务服务已停止，请检查 38889 端口或重新选择目录"
                self.server = nil
            }
        }
        do {
            try process.run()
            server = process
            dataDirectory = folder
            status = "正在启动任务服务…"
            Task { await waitUntilReady(process, folder: folder) }
        } catch {
            status = "无法启动任务服务：\(error.localizedDescription)"
        }
    }

    private func waitUntilReady(_ process: Process, folder: URL) async {
        for _ in 0..<30 {
            guard process.isRunning else { return }
            do {
                let url = QuickClient.baseURL.appending(path: "api/health")
                let (_, response) = try await URLSession.shared.data(from: url)
                if (response as? HTTPURLResponse)?.statusCode == 200 {
                    guard server === process else { return }
                    ready = true
                    status = "已连接 \(folder.path)"
                    UserDefaults.standard.set(folder.path, forKey: folderKey)
                    return
                }
            } catch { }
            try? await Task.sleep(for: .milliseconds(200))
        }
        if server === process {
            status = "任务服务启动超时；请确认 38889 端口没有被占用"
            stop()
        }
    }

    func requestQuickAdd() {
        quickAddRequest += 1
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    func notifyMutation() {
        refreshRequest += 1
        WidgetCenter.shared.reloadAllTimelines()
    }

    func stop() {
        ready = false
        if let server, server.isRunning { server.terminate() }
        server = nil
    }
}
