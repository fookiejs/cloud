package com.taskbridge.mobile.domain.models

import android.net.Uri
import com.taskbridge.mobile.data.SessionStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object ConnectConfigParser {
    data class ConnectConfig(
        val host: String,
        val port: Int,
        val secure: Boolean,
        val token: String?,
    )

    private data class ServerInfo(
        val host: String,
        val port: Int,
        val secure: Boolean,
    )

    private val fetchClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    fun parse(raw: String): ConnectConfig? {
        val text = raw.trim()
        if (text.startsWith("{")) {
            return parseJson(text)
        }
        return parseUri(text)
    }

    suspend fun resolve(raw: String): ConnectConfig? {
        val text = raw.trim()
        val fetchUrl = when {
            text.startsWith("http", ignoreCase = true) && text.contains("connect.json") -> text
            else -> {
                val uri = Uri.parse(text)
                if (uri.scheme == "taskbridge" && uri.host == "connect") {
                    uri.getQueryParameter("fetch")
                } else {
                    null
                }
            }
        }
        if (!fetchUrl.isNullOrBlank()) {
            fetchJson(fetchUrl)?.let { return it }
        }
        return parse(text)
    }

    private suspend fun fetchJson(url: String): ConnectConfig? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url(url)
                .get()
                .addHeader("Accept", "application/json")
                .addHeader("ngrok-skip-browser-warning", "true")
                .build()
            fetchClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body?.string() ?: return@withContext null
                parseJson(body)
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun parseJson(text: String): ConnectConfig? {
        return try {
            val json = JSONObject(text)
            val server = json.optString("server").takeIf { it.isNotBlank() }
            val token = json.optString("token").takeIf { it.isNotBlank() }
            if (server != null) {
                val info = parseServerUrl(server) ?: return null
                ConnectConfig(info.host, info.port, info.secure, token)
            } else {
                ConnectConfig(
                    host = json.getString("host"),
                    port = json.optInt("port", SessionStore.DEFAULT_PORT),
                    secure = json.optBoolean("secure", false),
                    token = token,
                )
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun parseUri(text: String): ConnectConfig? {
        return try {
            val uri = Uri.parse(text)
            if (uri.scheme != "taskbridge") return null
            when (uri.host) {
                "auth" -> {
                    val server = uri.getQueryParameter("server") ?: return null
                    val info = parseServerUrl(server) ?: return null
                    val token = uri.getQueryParameter("token")?.takeIf { it.isNotBlank() }
                    ConnectConfig(info.host, info.port, info.secure, token)
                }
                "connect" -> {
                    val host = uri.getQueryParameter("host") ?: return null
                    val port = uri.getQueryParameter("port")?.toIntOrNull()
                        ?: SessionStore.DEFAULT_PORT
                    val secure = uri.getQueryParameter("secure") == "1"
                    val token = uri.getQueryParameter("token")?.takeIf { it.isNotBlank() }
                    ConnectConfig(host = host, port = port, secure = secure, token = token)
                }
                else -> null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun parseServerUrl(server: String): ServerInfo? {
        return try {
            val uri = Uri.parse(server.trim())
            val scheme = uri.scheme?.lowercase() ?: return null
            val host = uri.host ?: return null
            val secure = scheme == "https"
            val port = if (uri.port != -1) uri.port else if (secure) 443 else 80
            ServerInfo(host = host, port = port, secure = secure)
        } catch (_: Exception) {
            null
        }
    }
}
