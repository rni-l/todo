import AppIntents
import WidgetKit

struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "完成任务"
    static var description = IntentDescription("将任务标记为完成")
    static var openAppWhenRun = false

    @Parameter(title: "任务 ID") var taskID: String

    init() {}

    init(taskID: String) {
        self.taskID = taskID
    }

    func perform() async throws -> some IntentResult {
        _ = try await QuickClient.complete(taskID)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
