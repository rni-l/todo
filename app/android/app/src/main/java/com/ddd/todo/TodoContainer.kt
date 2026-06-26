package com.ddd.todo

import android.content.Context
import com.ddd.todo.data.PersistentCookieJar
import com.ddd.todo.data.PreferenceStore
import com.ddd.todo.data.TodoApi
import com.ddd.todo.data.TodoRepository
import com.ddd.todo.domain.NetworkMonitor
import com.ddd.todo.notification.ReminderScheduler
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

class TodoContainer(context: Context) {
    private val appContext = context.applicationContext
    val preferences = PreferenceStore(appContext)
    val cookieJar = PersistentCookieJar(preferences)
    val httpClient: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()
    val api = TodoApi(httpClient)
    val repository = TodoRepository(api, preferences, cookieJar)
    val networkMonitor = NetworkMonitor(appContext)
    val reminderScheduler = ReminderScheduler(appContext)
}
