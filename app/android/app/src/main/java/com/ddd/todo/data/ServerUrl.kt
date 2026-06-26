package com.ddd.todo.data

import java.net.URI

fun normalizeServerUrl(raw: String): String {
    val trimmed = raw.trim().trimEnd('/')
    if (trimmed.isBlank()) return ""
    val hasExplicitScheme = "://" in trimmed
    val withScheme = if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        trimmed
    } else if (hasExplicitScheme) {
        trimmed
    } else {
        "http://$trimmed"
    }
    val uri = URI(withScheme)
    require(uri.host != null) { "invalid_server_url" }
    require(uri.scheme == "http" || uri.scheme == "https") { "unsupported_server_scheme" }
    return uri.toString().trimEnd('/')
}

fun joinApiPath(baseUrl: String, path: String): String {
    val base = normalizeServerUrl(baseUrl)
    val cleanPath = if (path.startsWith("/")) path else "/$path"
    return "$base$cleanPath"
}
