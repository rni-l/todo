import Foundation

struct QuickTask: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let dueDate: String?
    let priority: String
}

struct QuickSnapshot: Codable {
    let date: String
    let updatedAt: String
    let overdueCount: Int
    let todayCount: Int
    let overdue: [QuickTask]
    let today: [QuickTask]
}

enum QuickError: LocalizedError {
    case missingSecret
    case unauthorized
    case unavailable

    var errorDescription: String? {
        switch self {
        case .missingSecret: return "缺少本机快捷入口密钥"
        case .unauthorized: return "请先在主窗口登录"
        case .unavailable: return "应用服务未运行"
        }
    }
}

struct QuickClient {
    static let baseURL = URL(string: "http://127.0.0.1:38889")!

    static func token() throws -> String {
        guard let url = Bundle.main.url(forResource: "QuickAccess", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let value = try? JSONSerialization.jsonObject(with: data) as? [String: String],
              let token = value["token"], !token.isEmpty else {
            throw QuickError.missingSecret
        }
        return token
    }

    static func request(_ path: String, method: String = "GET", body: Data? = nil) async throws -> QuickSnapshot {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.timeoutInterval = 8
        request.setValue("Bearer \(try token())", forHTTPHeaderField: "Authorization")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let response = response as? HTTPURLResponse else { throw QuickError.unavailable }
            if response.statusCode == 401 { throw QuickError.unauthorized }
            guard (200..<300).contains(response.statusCode) else { throw QuickError.unavailable }
            return try JSONDecoder().decode(QuickSnapshot.self, from: data)
        } catch let error as QuickError {
            throw error
        } catch {
            throw QuickError.unavailable
        }
    }

    static func snapshot() async throws -> QuickSnapshot {
        try await request("api/mac/quick")
    }

    static func add(_ title: String) async throws -> QuickSnapshot {
        let body = try JSONSerialization.data(withJSONObject: ["title": title])
        return try await request("api/mac/quick/tasks", method: "POST", body: body)
    }

    static func complete(_ taskID: String) async throws -> QuickSnapshot {
        try await request("api/mac/quick/tasks/\(taskID)/complete", method: "POST")
    }
}
