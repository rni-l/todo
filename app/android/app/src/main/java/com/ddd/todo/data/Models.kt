package com.ddd.todo.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class HealthResponse(
    val ok: Boolean = false,
    val appVersion: String = "",
    val dataVersion: Int = 0
)

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class LoginResponse(
    val ok: Boolean = false,
    val user: User = User()
)

@Serializable
data class User(
    val username: String = ""
)

@Serializable
data class PublicData(
    val version: Int = 0,
    val createdAt: String = "",
    val updatedAt: String = "",
    val user: User = User(),
    val settings: AppSettings = AppSettings(),
    val projects: List<Project> = emptyList(),
    val tags: List<Tag> = emptyList(),
    val filters: List<SmartFilter> = emptyList(),
    val tasks: List<Task> = emptyList()
)

@Serializable
data class AppSettings(
    val theme: String = "system",
    val density: String = "comfortable",
    val defaultReminderTime: String = "09:00",
    val notificationsEnabled: Boolean = false,
    val dockDrawer: Boolean = true,
    val sidebarCollapsed: Boolean = false,
    val compactRows: Boolean = false,
    val pwaInstallDismissed: Boolean = false,
    val calendarDayLimit: Int = 3,
    val uploadUrlConfig: UploadUrlConfig = UploadUrlConfig()
)

@Serializable
data class UploadUrlConfig(
    val accessPrefix: String = "/uploads",
    val baseUrl: String = "",
    val paramKey: String = "path"
)

@Serializable
data class Project(
    val id: String = "",
    val name: String = "",
    val color: String = "blue",
    val description: String = "",
    val archived: Boolean = false,
    val order: Long = 0,
    val sections: List<ProjectSection> = emptyList(),
    val createdAt: String = "",
    val updatedAt: String = ""
)

@Serializable
data class ProjectSection(
    val id: String = "",
    val name: String = "",
    val order: Long = 0
)

@Serializable
data class Tag(
    val id: String = "",
    val name: String = "",
    val color: String = "blue",
    val createdAt: String = "",
    val updatedAt: String = ""
)

@Serializable
data class SmartFilter(
    val id: String = "",
    val name: String = "",
    val pinned: Boolean = false,
    val conditions: List<SmartFilterCondition> = emptyList(),
    val sort: String = "",
    val group: String = "",
    val order: Long = 0,
    val createdAt: String = "",
    val updatedAt: String = ""
)

@Serializable
data class SmartFilterCondition(
    val field: String = "",
    val operator: String? = null,
    val value: JsonElement? = null
)

@Serializable
data class Task(
    val id: String = "",
    val title: String = "",
    val completed: Boolean = false,
    val completedAt: String? = null,
    val closed: Boolean = false,
    val closedAt: String? = null,
    val projectId: String? = null,
    val sectionId: String? = null,
    val startDate: String? = null,
    val dueDate: String? = null,
    val reminderAt: String? = null,
    val reminderEndAt: String? = null,
    val priority: Priority = Priority.NONE,
    val urgent: Boolean = false,
    val tags: List<String> = emptyList(),
    val recurrence: Recurrence? = null,
    val description: String = "",
    val subtasks: List<Subtask> = emptyList(),
    val attachments: List<Attachment> = emptyList(),
    val order: Long = 0,
    val createdAt: String = "",
    val updatedAt: String = ""
)

@Serializable
enum class Priority {
    @SerialName("none")
    NONE,

    @SerialName("low")
    LOW,

    @SerialName("medium")
    MEDIUM,

    @SerialName("high")
    HIGH
}

@Serializable
data class Recurrence(
    val type: String = "",
    val interval: Int = 1
)

@Serializable
data class Subtask(
    val id: String? = null,
    val title: String = "",
    val completed: Boolean = false,
    val order: Long = 0,
    val dueDate: String? = null,
    val priority: Priority = Priority.NONE
)

@Serializable
data class Attachment(
    val id: String = "",
    val originalName: String = "",
    val size: Long = 0,
    val mimeType: String = "",
    val uploadedAt: String = "",
    val storageName: String = "",
    val relativePath: String? = null,
    val accessPath: String? = null,
    val missing: Boolean = false
)

@Serializable
data class TaskMutationResponse(
    val task: Task = Task(),
    val data: PublicData = PublicData()
)

@Serializable
data class DeleteResponse(
    val ok: Boolean = false,
    val data: PublicData = PublicData()
)

@Serializable
data class TaskPatch(
    val title: String? = null,
    val completed: Boolean? = null,
    val closed: Boolean? = null,
    val projectId: String? = null,
    val sectionId: String? = null,
    val startDate: String? = null,
    val dueDate: String? = null,
    val reminderAt: String? = null,
    val reminderEndAt: String? = null,
    val priority: Priority? = null,
    val urgent: Boolean? = null,
    val tags: List<String>? = null,
    val description: String? = null,
    val subtasks: List<Subtask>? = null
)

@Serializable
data class CreateTaskRequest(
    val title: String,
    val projectId: String? = null,
    val sectionId: String? = null,
    val startDate: String? = null,
    val dueDate: String? = null,
    val reminderAt: String? = null,
    val reminderEndAt: String? = null,
    val priority: Priority = Priority.NONE,
    val urgent: Boolean = false,
    val tags: List<String> = emptyList(),
    val description: String = "",
    val subtasks: List<Subtask> = emptyList()
)
