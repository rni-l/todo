import AppKit
import SwiftUI
import WebKit
import WidgetKit

final class TodoMacDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        if let iconURL = Bundle.main.url(forResource: "TodoMac", withExtension: "icns"),
           let icon = NSImage(contentsOf: iconURL) {
            NSApplication.shared.applicationIconImage = icon
        }
    }

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
            ) { [weak self, weak view] _ in self?.refreshData(in: view) }
        }

        func refreshData(in view: WKWebView?) {
            view?.evaluateJavaScript("window.dispatchEvent(new Event('todo:refresh'))")
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
            context.coordinator.refreshData(in: view)
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
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 21))
                    .foregroundStyle(.tint)
                VStack(alignment: .leading, spacing: 2) {
                    Text("个人 TODO").font(.headline)
                    Text("今天与未来 7 天").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button {
                    openWindow(id: "main")
                    NSApplication.shared.activate(ignoringOtherApps: true)
                } label: {
                    Image(systemName: "arrow.up.right.square")
                }
                .buttonStyle(.borderless)
                .help("打开主窗口")
            }
            .padding(.bottom, 14)
            if let snapshot {
                HStack(spacing: 8) {
                    countBadge("今天", count: snapshot.todayCount, color: .green)
                    countBadge("未来 7 天", count: snapshot.upcomingCount, color: .blue)
                    if snapshot.overdueCount > 0 {
                        countBadge("逾期", count: snapshot.overdueCount, color: .red)
                    }
                }
                .padding(.bottom, 12)
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        taskList("已逾期", tasks: snapshot.overdue, color: .red)
                        taskList("今天", tasks: snapshot.today, color: .green)
                        taskList("未来 7 天", tasks: snapshot.upcoming, color: .blue, showDate: true)
                        if snapshot.todayCount == 0 && snapshot.overdueCount == 0 && snapshot.upcomingCount == 0 {
                            Text("今天和未来 7 天都没有待办任务")
                                .font(.subheadline).foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 28)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(height: taskListHeight(for: snapshot))
                Divider().padding(.vertical, 12)
                HStack {
                    TextField("添加今天的任务", text: $title)
                        .textFieldStyle(.roundedBorder)
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
            Divider().padding(.vertical, 12)
            HStack {
                Button {
                    Task { await refresh() }
                } label: {
                    Label("刷新", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                Spacer()
                Button("退出应用") { NSApplication.shared.terminate(nil) }
                    .buttonStyle(.borderless)
            }
        }
        .padding(18)
        .frame(width: 380)
        .task { await refresh() }
        .onChange(of: runtime.ready) { _, ready in
            if ready { Task { await refresh() } }
        }
    }

    private func countBadge(_ title: String, count: Int, color: Color) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text("\(title) \(count)")
        }
        .font(.caption.weight(.medium))
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(color.opacity(0.11), in: Capsule())
    }

    private func taskListHeight(for snapshot: QuickSnapshot) -> CGFloat {
        let taskCount = snapshot.overdue.count + snapshot.today.count + snapshot.upcoming.count
        let sectionCount = [snapshot.overdue, snapshot.today, snapshot.upcoming].filter { !$0.isEmpty }.count
        return CGFloat(min(340, max(82, taskCount * 36 + sectionCount * 30 + 16)))
    }

    @ViewBuilder
    private func taskList(_ heading: String, tasks: [QuickTask], color: Color, showDate: Bool = false) -> some View {
        if !tasks.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(heading).font(.caption.bold()).foregroundStyle(.secondary)
                    Spacer()
                    Text("\(tasks.count)").font(.caption.monospacedDigit()).foregroundStyle(.tertiary)
                }
                .padding(.bottom, 4)
                ForEach(tasks) { task in
                    Button {
                        Task { await complete(task.id) }
                    } label: {
                        HStack(spacing: 9) {
                            Image(systemName: "circle")
                                .font(.system(size: 17))
                                .foregroundStyle(color)
                            Text(task.title)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 4)
                            if showDate, let dueDate = task.dueDate {
                                Text(String(dueDate.suffix(5)))
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 5)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .help("完成：\(task.title)")
                }
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
