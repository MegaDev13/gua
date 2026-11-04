package br.com.androidwebremote

import android.accessibilityservice.AccessibilityService
import android.content.Context
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.io.ByteArrayInputStream

class WebServer(private val context: Context) : NanoHTTPD(8080) {
    private var claim = ""
    override fun serve(session: IHTTPSession): Response {
        fun response(status: Response.Status, type: String, body: String): Response = newFixedLengthResponse(status, type, body).apply {
            addHeader("Cache-Control", "no-store"); addHeader("X-Content-Type-Options", "nosniff")
            addHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'")
            addHeader("X-Frame-Options", "DENY")
        }
        fun fail() = response(Response.Status.FORBIDDEN, "text/plain", "Acesso negado")
        val path = session.uri
        if (session.method == Method.GET && path in listOf("/", "/app.js", "/style.css")) {
            val file = when (path) { "/" -> "index.html"; "/app.js" -> "app.js"; else -> "style.css" }
            val type = when (file) { "index.html" -> "text/html; charset=utf-8"; "app.js" -> "application/javascript; charset=utf-8"; else -> "text/css; charset=utf-8" }
            return response(Response.Status.OK, type, context.assets.open(file).bufferedReader().use { it.readText() })
        }
        // The custom header forces cross-origin browser requests through CORS preflight, which is denied.
        if (session.headers["x-remote-request"] != "1") return fail()
        if (session.headers["sec-fetch-site"]?.let { it != "same-origin" && it != "none" } == true) return fail()
        if (session.method == Method.POST && path == "/pair") {
            session.parseBody(mutableMapOf())
            val pin = session.parameters["pin"]?.firstOrNull() ?: ""
            val secret = session.parameters["claim"]?.firstOrNull() ?: ""
            if (secret.length != 64 || !secret.all { it in "0123456789abcdef" }) return fail()
            synchronized(this) { if (!State.request(pin)) return fail(); claim = secret }
            return response(Response.Status.OK, "text/plain", "Aguardando aprovação no celular")
        }
        if (session.method == Method.GET && path == "/claim") {
            if (claim.isEmpty() || session.headers["x-claim"] != claim) return fail()
            return if (State.approved && System.currentTimeMillis() < State.expires) response(Response.Status.OK, "text/plain", State.token) else response(Response.Status.ACCEPTED, "text/plain", "Aguardando aprovação")
        }
        if (!State.authorized(session.headers["x-session-token"])) return fail()
        if (session.method == Method.GET && path == "/frame") {
            val bytes = State.frame ?: return response(Response.Status.ACCEPTED, "text/plain", "Aguardando quadro")
            return newFixedLengthResponse(Response.Status.OK, "image/jpeg", ByteArrayInputStream(bytes), bytes.size.toLong()).apply { addHeader("Cache-Control", "no-store"); addHeader("X-Content-Type-Options", "nosniff") }
        }
        if (session.method == Method.POST && path == "/input") {
            session.parseBody(mutableMapOf())
            val svc = ControlService.instance ?: return response(Response.Status.SERVICE_UNAVAILABLE, "text/plain", "Ative a acessibilidade no celular")
            val p = session.parameters
            when (p["action"]?.firstOrNull()) {
                "gesture" -> {
                    fun f(k: String) = p[k]?.firstOrNull()?.toFloatOrNull()?.takeIf { it.isFinite() } ?: 0f
                    svc.gesture(f("x1"), f("y1"), f("x2"), f("y2"), p["duration"]?.firstOrNull()?.toLongOrNull() ?: 100)
                }
                "back" -> svc.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
                "home" -> svc.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
                "recent" -> svc.performGlobalAction(AccessibilityService.GLOBAL_ACTION_RECENTS)
                "text" -> if (!svc.text((p["text"]?.firstOrNull() ?: "").take(2000))) return response(Response.Status.BAD_REQUEST, "text/plain", "Campo não aceita edição")
                else -> return fail()
            }
            return response(Response.Status.OK, "text/plain", "OK")
        }
        if (session.method == Method.POST && path == "/disconnect") { State.reset(); return response(Response.Status.OK, "text/plain", "Sessão revogada") }
        return response(Response.Status.NOT_FOUND, "text/plain", "Não encontrado")
    }
}
