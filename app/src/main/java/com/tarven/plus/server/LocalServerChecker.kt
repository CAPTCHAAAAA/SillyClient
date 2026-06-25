package com.tarven.plus.server

import java.net.HttpURLConnection
import java.net.URL

class LocalServerChecker {

    fun waitUntilReady(
        url: String = "http://127.0.0.1:8000/",
        timeoutMs: Long = 60_000,
        log: (String) -> Unit
    ): Boolean {
        val start = System.currentTimeMillis()
        while (System.currentTimeMillis() - start < timeoutMs) {
            if (isReady(url)) {
                log("本地服务已就绪: $url")
                return true
            }
            log("等待本地服务启动...")
            Thread.sleep(1500)
        }
        log("等待超时，本地服务没有响应")
        return false
    }

    private fun isReady(url: String): Boolean {
        return try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 1000
            conn.readTimeout = 1000
            conn.requestMethod = "GET"
            conn.responseCode in 200..499
        } catch (_: Throwable) {
            false
        }
    }
}
