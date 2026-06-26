package com.ddd.todo

import android.app.Application
import com.ddd.todo.notification.ReminderScheduler

class TodoApplication : Application() {
    lateinit var container: TodoContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = TodoContainer(this)
        ReminderScheduler.createNotificationChannel(this)
    }
}
