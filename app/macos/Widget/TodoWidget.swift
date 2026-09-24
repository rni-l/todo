import AppIntents
import SwiftUI
import WidgetKit

private struct TodoEntry: TimelineEntry {
    let date: Date
    let snapshot: QuickSnapshot?
    let isStale: Bool
    let message: String
}

private struct TodoProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodoEntry {
        TodoEntry(date: .now, snapshot: nil, isStale: false, message: "今日任务")
    }

    func getSnapshot(in context: Context, completion: @escaping (TodoEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
        } else {
            load(completion: completion)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodoEntry>) -> Void) {
        load { entry in
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800))))
        }
    }

    private func load(completion: @escaping (TodoEntry) -> Void) {
        Task {
            do {
                let snapshot = try await QuickClient.snapshot()
                if let data = try? JSONEncoder().encode(snapshot) {
                    UserDefaults.standard.set(data, forKey: "lastQuickSnapshot")
                }
                completion(TodoEntry(date: .now, snapshot: snapshot, isStale: false, message: ""))
            } catch {
                let cached = UserDefaults.standard.data(forKey: "lastQuickSnapshot")
                    .flatMap { try? JSONDecoder().decode(QuickSnapshot.self, from: $0) }
                completion(TodoEntry(date: .now, snapshot: cached, isStale: true, message: error.localizedDescription))
            }
        }
    }
}

private struct TodoWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodoEntry

    private var visibleTasks: [QuickTask] {
        let combined = (entry.snapshot?.overdue ?? []) + (entry.snapshot?.today ?? [])
        return Array(combined.prefix(family == .systemSmall ? 2 : 5))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(.tint)
                Text("今日任务").font(.headline)
                Spacer(minLength: 2)
                Link(destination: URL(string: "myselftodo://quick-add")!) {
                    Image(systemName: "plus.circle.fill")
                }
                .accessibilityLabel("添加任务")
            }
            if let snapshot = entry.snapshot {
                Text("今天 \(snapshot.todayCount) · 逾期 \(snapshot.overdueCount)")
                    .font(.caption2).foregroundStyle(.secondary)
                if visibleTasks.isEmpty {
                    Spacer(minLength: 0)
                    Text("今天没有待办任务").font(.caption).foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                } else {
                    ForEach(visibleTasks) { task in
                        HStack(spacing: 6) {
                            Button(intent: CompleteTaskIntent(taskID: task.id)) {
                                Image(systemName: "circle")
                            }
                            .buttonStyle(.plain)
                            .disabled(entry.isStale)
                            Text(task.title).font(.caption).lineLimit(1)
                            Spacer(minLength: 0)
                        }
                    }
                    Spacer(minLength: 0)
                }
                if entry.isStale {
                    Text("应用已退出 · 显示上次内容")
                        .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                }
            } else {
                Spacer(minLength: 0)
                Text(entry.message.isEmpty ? "打开应用查看任务" : entry.message)
                    .font(.caption).foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
        }
        .padding(12)
        .containerBackground(for: .widget) { Color(nsColor: .windowBackgroundColor) }
    }
}

private struct TodoDesktopWidget: Widget {
    let kind = "TodoDesktopWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodoProvider()) { entry in
            TodoWidgetView(entry: entry)
        }
        .configurationDisplayName("今日任务")
        .description("快速查看和完成今天及逾期的任务")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct TodoWidgetBundle: WidgetBundle {
    var body: some Widget { TodoDesktopWidget() }
}
