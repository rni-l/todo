package com.ddd.todo.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.todoDataStore by preferencesDataStore(name = "todo_android")

data class StoredSession(
    val serverUrl: String = "",
    val cookies: Set<String> = emptySet(),
    val cachedPublicDataJson: String = "",
    val lastSyncAt: String = ""
) {
    val isConfigured: Boolean get() = serverUrl.isNotBlank()
}

class PreferenceStore(context: Context) {
    private val dataStore = context.todoDataStore

    val sessionFlow: Flow<StoredSession> = dataStore.data.map { prefs ->
        StoredSession(
            serverUrl = prefs[SERVER_URL].orEmpty(),
            cookies = prefs[COOKIES].orEmpty().lines().filter { it.isNotBlank() }.toSet(),
            cachedPublicDataJson = prefs[CACHED_DATA].orEmpty(),
            lastSyncAt = prefs[LAST_SYNC_AT].orEmpty()
        )
    }

    suspend fun currentSession(): StoredSession = sessionFlow.first()

    suspend fun saveServerUrl(serverUrl: String) {
        dataStore.edit { prefs ->
            prefs[SERVER_URL] = normalizeServerUrl(serverUrl)
        }
    }

    suspend fun saveCookies(cookies: Set<String>) {
        dataStore.edit { prefs ->
            prefs[COOKIES] = cookies.joinToString("\n")
        }
    }

    suspend fun saveCachedData(data: PublicData, syncedAt: String) {
        dataStore.edit { prefs ->
            prefs[CACHED_DATA] = TodoJson.encodeToString(PublicData.serializer(), data)
            prefs[LAST_SYNC_AT] = syncedAt
        }
    }

    suspend fun clearSession() {
        dataStore.edit { prefs ->
            prefs.remove(COOKIES)
            prefs.remove(CACHED_DATA)
            prefs.remove(LAST_SYNC_AT)
        }
    }

    companion object {
        private val SERVER_URL = stringPreferencesKey("server_url")
        private val COOKIES = stringPreferencesKey("cookies")
        private val CACHED_DATA = stringPreferencesKey("cached_public_data_json")
        private val LAST_SYNC_AT = stringPreferencesKey("last_sync_at")
    }
}
