package com.ddd.todo.data

import com.ddd.todo.domain.nowIso
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class OfflineWriteException : IllegalStateException("offline_read_only")
class MissingServerException : IllegalStateException("missing_server")

data class RepositorySnapshot(
    val serverUrl: String = "",
    val data: PublicData? = null,
    val lastSyncAt: String = "",
    val hasCachedData: Boolean = false
)

class TodoRepository(
    private val api: TodoApi,
    private val preferences: PreferenceStore,
    private val cookieJar: PersistentCookieJar
) {
    val snapshotFlow: Flow<RepositorySnapshot> = preferences.sessionFlow.map { session ->
        val cached = session.cachedPublicDataJson.takeIf { it.isNotBlank() }?.let {
            runCatching { TodoJson.decodeFromString(PublicData.serializer(), it) }.getOrNull()
        }
        RepositorySnapshot(
            serverUrl = session.serverUrl,
            data = cached,
            lastSyncAt = session.lastSyncAt,
            hasCachedData = cached != null
        )
    }

    suspend fun checkServer(rawServerUrl: String): HealthResponse {
        val serverUrl = normalizeServerUrl(rawServerUrl)
        return api.health(serverUrl)
    }

    suspend fun login(rawServerUrl: String, username: String, password: String): PublicData {
        val serverUrl = normalizeServerUrl(rawServerUrl)
        api.health(serverUrl)
        preferences.saveServerUrl(serverUrl)
        api.login(serverUrl, username.trim(), password)
        return refresh()
    }

    suspend fun refresh(): PublicData {
        val session = preferences.currentSession()
        val serverUrl = session.serverUrl.ifBlank { throw MissingServerException() }
        val data = api.data(serverUrl)
        preferences.saveCachedData(data, nowIso())
        return data
    }

    suspend fun logout() {
        val serverUrl = preferences.currentSession().serverUrl
        runCatching {
            if (serverUrl.isNotBlank()) api.logout(serverUrl)
        }
        cookieJar.clear()
        preferences.clearSession()
    }

    suspend fun createTask(request: CreateTaskRequest, online: Boolean): PublicData {
        if (!online) throw OfflineWriteException()
        val serverUrl = preferences.currentSession().serverUrl.ifBlank { throw MissingServerException() }
        val response = api.createTask(serverUrl, request)
        preferences.saveCachedData(response.data, nowIso())
        return response.data
    }

    suspend fun updateTask(taskId: String, patch: TaskPatch, online: Boolean): PublicData {
        if (!online) throw OfflineWriteException()
        val serverUrl = preferences.currentSession().serverUrl.ifBlank { throw MissingServerException() }
        val response = api.updateTask(serverUrl, taskId, patch)
        preferences.saveCachedData(response.data, nowIso())
        return response.data
    }

    suspend fun deleteTask(taskId: String, online: Boolean): PublicData {
        if (!online) throw OfflineWriteException()
        val serverUrl = preferences.currentSession().serverUrl.ifBlank { throw MissingServerException() }
        val response = api.deleteTask(serverUrl, taskId)
        preferences.saveCachedData(response.data, nowIso())
        return response.data
    }
}
