package com.ddd.todo.ui

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors: ColorScheme = lightColorScheme(
    primary = Color(0xFF08786F),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDFF2EE),
    onPrimaryContainer = Color(0xFF055F59),
    secondary = Color(0xFF51605D),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFEEF5F3),
    onSecondaryContainer = Color(0xFF17211F),
    surface = Color(0xFFFBFDFC),
    onSurface = Color(0xFF17211F),
    surfaceContainer = Color(0xFFEEF5F3),
    surfaceVariant = Color(0xFFE4EEEB),
    outline = Color(0xFFDCE8E5),
    outlineVariant = Color(0xFFC6D6D2),
    background = Color(0xFFF3F7F6),
    onBackground = Color(0xFF17211F),
    error = Color(0xFFB23A31)
)

@Composable
fun TodoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = MaterialTheme.typography,
        content = content
    )
}
