package com.ddd.todo.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ServerUrlTest {
    @Test
    fun normalizesBareHostToHttpUrl() {
        assertEquals("http://192.168.1.10:38887", normalizeServerUrl(" 192.168.1.10:38887/ "))
    }

    @Test
    fun keepsHttpsUrl() {
        assertEquals("https://todo.example.com", normalizeServerUrl("https://todo.example.com/"))
    }

    @Test
    fun rejectsUnsupportedSchemes() {
        assertThrows(IllegalArgumentException::class.java) {
            normalizeServerUrl("file:///tmp/todo")
        }
    }
}
