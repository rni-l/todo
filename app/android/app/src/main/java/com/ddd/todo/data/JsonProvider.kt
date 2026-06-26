package com.ddd.todo.data

import kotlinx.serialization.json.Json

val TodoJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = false
}
