package br.com.androidwebremote

import java.security.SecureRandom
import java.util.Base64

object State {
    private val random = SecureRandom()
    @Volatile var running = false
    @Volatile var frame: ByteArray? = null
    @Volatile var pending = false
    @Volatile var approved = false
    @Volatile var token = ""
    @Volatile var code = ""
    @Volatile var failures = 0
    @Volatile var expires = 0L
    @Volatile var width = 1
    @Volatile var height = 1
    @Volatile var message = "Desconectado"
    @Synchronized fun reset() {
        frame = null; pending = false; approved = false; token = ""; failures = 0
        code = (10000000 + random.nextInt(90000000)).toString()
        expires = System.currentTimeMillis() + 5 * 60_000L
    }
    @Synchronized fun request(pin: String): Boolean {
        if (!running || approved || pending || failures >= 5 || System.currentTimeMillis() > expires) return false
        if (pin != code) { failures++; return false }
        pending = true
        return true
    }
    @Synchronized fun approve() {
        if (!pending) return
        val bytes = ByteArray(32); random.nextBytes(bytes)
        token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        approved = true; pending = false; expires = System.currentTimeMillis() + 30 * 60_000L
    }
    fun authorized(candidate: String?): Boolean = running && approved && System.currentTimeMillis() < expires && candidate != null && java.security.MessageDigest.isEqual(token.toByteArray(), candidate.toByteArray())
}
