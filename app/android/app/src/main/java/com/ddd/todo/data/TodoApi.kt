package com.ddd.todo.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.encodeToString
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class ApiException(
    val statusCode: Int,
    message: String
) : IOException(message)

class TodoApi(
    private val client: OkHttpClient
) {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun health(serverUrl: String): HealthResponse = get(serverUrl, "/api/health", HealthResponse.serializer())

    suspend fun login(serverUrl: String, username: String, password: String): LoginResponse {
        return post(
            serverUrl = serverUrl,
            path = "/api/auth/login",
            requestBody = TodoJson.encodeToString(LoginRequest(username, password)),
            serializer = LoginResponse.serializer()
        )
    }

    suspend fun logout(serverUrl: String) {
        postText(serverUrl, "/api/auth/logout", "{}")
    }

    suspend fun data(serverUrl: String): PublicData = get(serverUrl, "/api/data", PublicData.serializer())

    suspend fun createTask(serverUrl: String, request: CreateTaskRequest): TaskMutationResponse {
        return post(
            serverUrl = serverUrl,
            path = "/api/tasks",
            requestBody = TodoJson.encodeToString(request),
            serializer = TaskMutationResponse.serializer()
        )
    }

    suspend fun updateTask(serverUrl: String, taskId: String, patch: TaskPatch): TaskMutationResponse {
        return patch(
            serverUrl = serverUrl,
            path = "/api/tasks/${taskId.encodePathSegment()}",
            requestBody = TodoJson.encodeToString(patch),
            serializer = TaskMutationResponse.serializer()
        )
    }

    suspend fun deleteTask(serverUrl: String, taskId: String): DeleteResponse {
        return delete(serverUrl, "/api/tasks/${taskId.encodePathSegment()}", DeleteResponse.serializer())
    }

    private suspend fun <T> get(serverUrl: String, path: String, serializer: KSerializer<T>): T {
        val request = Request.Builder()
            .url(joinApiPath(serverUrl, path))
            .get()
            .build()
        return execute(request, serializer)
    }

    private suspend fun <T> post(
        serverUrl: String,
        path: String,
        requestBody: String,
        serializer: KSerializer<T>
    ): T {
        val request = Request.Builder()
            .url(joinApiPath(serverUrl, path))
            .post(requestBody.toRequestBody(jsonMediaType))
            .build()
        return execute(request, serializer)
    }

    private suspend fun postText(serverUrl: String, path: String, requestBody: String) {
        val request = Request.Builder()
            .url(joinApiPath(serverUrl, path))
            .post(requestBody.toRequestBody(jsonMediaType))
            .build()
        executeText(request)
    }

    private suspend fun <T> patch(
        serverUrl: String,
        path: String,
        requestBody: String,
        serializer: KSerializer<T>
    ): T {
        val request = Request.Builder()
            .url(joinApiPath(serverUrl, path))
            .patch(requestBody.toRequestBody(jsonMediaType))
            .build()
        return execute(request, serializer)
    }

    private suspend fun <T> delete(serverUrl: String, path: String, serializer: KSerializer<T>): T {
        val request = Request.Builder()
            .url(joinApiPath(serverUrl, path))
            .delete()
            .build()
        return execute(request, serializer)
    }

    private suspend fun <T> execute(request: Request, serializer: KSerializer<T>): T = withContext(Dispatchers.IO) {
        val text = executeText(request)
        TodoJson.decodeFromString(serializer, text)
    }

    private suspend fun executeText(request: Request): String = withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
            val body = response.body.string()
            if (!response.isSuccessful) {
                val message = runCatching {
                    TodoJson.parseToJsonElement(body).toString()
                }.getOrElse { response.message }
                throw ApiException(response.code, message)
            }
            body
        }
    }
}

private fun String.encodePathSegment(): String = java.net.URLEncoder.encode(this, Charsets.UTF_8.name()).replace("+", "%20")
