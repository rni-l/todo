import AppKit
import SwiftUI
import WebKit
import WidgetKit

final class TodoMacDelegate: NSObject, NSApplicationDelegate {
    func applicationWillTerminate(_ notification: Notification) {
        MainActor.assumeIsolated { RuntimeController.shared.stop() }
    }
}

@main
struct TodoMacApp: App {
    @NSApplicationDelegateAdaptor(TodoMacDelegate.self) private var delegate
    @StateObject private var runtime = RuntimeController.shared
    @Environment(\.openWindow) private var openWindow

    var body: some Scene {
        WindowGroup(id: "main") {
            MainWindow()
                .environmentObject(runtime)
                .frame(minWidth: 1024, minHeight: 650)
                .task { runtime.startSavedFolder() }
                .onOpenURL { url in
                    if url.host == "quick-add" {
                        openWindow(id: "main")
                        runtime.requestQuickAdd()
                    }
                }
        }
        .defaultSize(width: 1280, height: 820)

        MenuBarExtra("个人 TODO", systemImage: "checkmark.circle") {
            MenuPanel()
                .environmentObject(runtime)
        }
        .menuBarExtraStyle(.window)
    }
}

private struct MainWindow: View {
    @EnvironmentObject private var runtime: RuntimeController

    var body: some View {
        Group {
            if runtime.ready {
                TodoWebView(quickAddRequest: runtime.quickAddRequest, refreshRequest: runtime.refreshRequest)
            } else {
                VStack(spacing: 18) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 44))
                    Text("个人 TODO").font(.title.bold())
                    Text(runtime.status).foregroundStyle(.secondary)
                    Button("选择数据目录…") { runtime.chooseFolder() }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("个人 TODO")
    }
}

private struct TodoWebView: NSViewRepresentable {
    let quickAddRequest: Int
    let refreshRequest: Int

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var lastQuickAdd = 0
        var lastRefresh = 0
        var pendingQuickAdd = false
        weak var webView: WKWebView?
        private var activationObserver: NSObjectProtocol?

        func attach(_ view: WKWebView) {
            webView = view
            activationObserver = NotificationCenter.default.addObserver(
                forName: NSApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak view] _ in view?.reload() }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if pendingQuickAdd { focusQuickAdd(in: webView) }
        }

        func focusQuickAdd(in view: WKWebView) {
            let script = """
            window.location.hash = '#/today';
            (() => {
              const focus = () => {
                const input = document.querySelector('.quick-add input');
                if (input) { input.focus(); return true; }
                return false;
              };
              requestAnimationFrame(() => requestAnimationFrame(() => {
                if (focus()) return;
                const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => observer.disconnect(), 600000);
              }));
              return true;
            })();
            """
            view.evaluateJavaScript(script) { [weak self] _, error in
                if error == nil { self?.pendingQuickAdd = false }
            }
        }

        deinit {
            if let activationObserver { NotificationCenter.default.removeObserver(activationObserver) }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(context.coordinator, name: "todoMac")
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        context.coordinator.attach(view)
        view.load(URLRequest(url: QuickClient.baseURL))
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        if refreshRequest != context.coordinator.lastRefresh {
            context.coordinator.lastRefresh = refreshRequest
            view.reload()
        }
        if quickAddRequest != context.coordinator.lastQuickAdd {
            context.coordinator.lastQuickAdd = quickAddRequest
            context.coordinator.pendingQuickAdd = true
            context.coordinator.focusQuickAdd(in: view)
        }
    }
}

private struct MenuPanel: View {
    @EnvironmentObject private var runtime: RuntimeController
    @Environment(\.openWindow) private var openWindow
    @State private var snapshot: QuickSnapshot?
    @State private var title = ""
    @State private var message = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("今日任务").font(.headline)
                Spacer()
                Button("打开主窗口") {
                    openWindow(id: "main")
                    NSApplication.shared.activate(ignoringOtherApps: true)
                }
            }
            if let snapshot {
                Text("今天 \(snapshot.todayCount) · 逾期 \(snapshot.overdueCount)")
                    .font(.caption).foregroundStyle(.secondary)
                taskList("已逾期", tasks: snapshot.overdue)
                taskList("今天", tasks: snapshot.today)
                if snapshot.today.isEmpty && snapshot.overdue.isEmpty {
                    Text("今天没有待办任务").foregroundStyle(.secondary)
                }
                HStack {
                    TextField("添加今天的任务", text: $title)
                        .onSubmit { Task { await addTask() } }
                    Button("添加") { Task { await addTask() } }
                        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            } else {
                Text(message.isEmpty ? "正在读取任务…" : message)
                    .foregroundStyle(.secondary)
                Button("打开主窗口登录") {
                    openWindow(id: "main")
                    NSApplication.shared.activate(ignoringOtherApps: true)
                }
            }
            if !message.isEmpty && snapshot != nil {
                Text(message).font(.caption).foregroundStyle(.red)
            }
            Divider()
            HStack {
                Button("刷新") { Task { await refresh() } }
                Spacer()
                Button("退出应用") { NSApplication.shared.terminate(nil) }
            }
        }
        .padding(16)
        .frame(width: 350)
        .task { await refresh() }
    }

    @ViewBuilder
    private func taskList(_ heading: String, tasks: [QuickTask]) -> some View {
        if !tasks.isEmpty {
            Text(heading).font(.caption.bold()).foregroundStyle(.secondary)
            ForEach(tasks.prefix(6)) { task in
                Button {
                    Task { await complete(task.id) }
                } label: {
                    Label(task.title, systemImage: "circle")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(1)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func refresh() async {
        guard runtime.ready else {
            snapshot = nil
            message = "任务服务未运行"
            return
        }
        do {
            snapshot = try await QuickClient.snapshot()
            message = ""
        } catch {
            snapshot = nil
            message = error.localizedDescription
        }
    }

    private func addTask() async {
        let clean = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        do {
            snapshot = try await QuickClient.add(clean)
            title = ""
            message = ""
            runtime.notifyMutation()
        } catch { message = error.localizedDescription }
    }

    private func complete(_ id: String) async {
        do {
            snapshot = try await QuickClient.complete(id)
            message = ""
            runtime.notifyMutation()
        } catch { message = error.localizedDescription }
    }
}
