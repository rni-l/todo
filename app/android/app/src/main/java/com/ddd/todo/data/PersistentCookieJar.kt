package com.ddd.todo.data

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class PersistentCookieJar(
    private val preferenceStore: PreferenceStore
) : CookieJar {
    private var cookies: MutableList<Cookie> = mutableListOf()

    init {
        runBlocking {
            cookies = preferenceStore.currentSession().cookies.mapNotNull(::decodeCookie).toMutableList()
        }
    }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (cookies.isEmpty()) return
        synchronized(this.cookies) {
            val updated = this.cookies.filterNot { existing ->
                cookies.any { it.name == existing.name && it.domain == existing.domain && it.path == existing.path }
            }.toMutableList()
            updated.addAll(cookies.filter { !it.isExpired() })
            this.cookies = updated
            persist()
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        synchronized(cookies) {
            val valid = cookies.filterNot { it.isExpired() }
            if (valid.size != cookies.size) {
                cookies = valid.toMutableList()
                persist()
            }
            return valid.filter { it.matches(url) }
        }
    }

    fun clear() {
        synchronized(cookies) {
            cookies.clear()
            persist()
        }
    }

    private fun persist() {
        val encoded = cookies.filterNot { it.isExpired() }.map { encodeCookie(it) }.toSet()
        runBlocking {
            preferenceStore.saveCookies(encoded)
        }
    }
}

private fun Cookie.isExpired(): Boolean = expiresAt < System.currentTimeMillis()

@Serializable
private data class StoredCookie(
    val name: String,
    val value: String,
    val expiresAt: Long,
    val domain: String,
    val path: String,
    val secure: Boolean,
    val httpOnly: Boolean,
    val hostOnly: Boolean
)

private fun encodeCookie(cookie: Cookie): String = TodoJson.encodeToString(
    StoredCookie.serializer(),
    StoredCookie(
        name = cookie.name,
        value = cookie.value,
        expiresAt = cookie.expiresAt,
        domain = cookie.domain,
        path = cookie.path,
        secure = cookie.secure,
        httpOnly = cookie.httpOnly,
        hostOnly = cookie.hostOnly
    )
)

private fun decodeCookie(raw: String): Cookie? = runCatching {
    val stored = TodoJson.decodeFromString(StoredCookie.serializer(), raw)
    Cookie.Builder()
        .name(stored.name)
        .value(stored.value)
        .expiresAt(stored.expiresAt)
        .path(stored.path)
        .apply {
            if (stored.hostOnly) hostOnlyDomain(stored.domain) else domain(stored.domain)
            if (stored.secure) secure()
            if (stored.httpOnly) httpOnly()
        }
        .build()
}.getOrNull()
