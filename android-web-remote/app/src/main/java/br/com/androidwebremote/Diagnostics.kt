package br.com.androidwebremote

import android.content.Context
import android.os.Build
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

object Diagnostics {
    fun report(context: Context): String {
        val now = System.currentTimeMillis()
        val browser = when {
            !State.approved -> "Nenhuma sessão autorizada"
            now >= State.expires -> "Sessão expirada"
            State.lastBrowserAt == 0L -> "Autorizado, sem requisição observada"
            now - State.lastBrowserAt < 10_000 -> "Requisições recentes recebidas"
            else -> "Sem requisição recente; navegador pode ter desconectado"
        }
        val capture = when {
            !State.running -> "Inativa"
            !State.approved -> "Projeção iniciada; aguardando autorização do navegador para produzir quadros"
            State.lastFrameAt == 0L -> "Aguardando primeiro quadro"
            now - State.lastFrameAt < 10_000 -> "Quadros recentes produzidos"
            else -> "Nenhum quadro recente"
        }
        return """ANDROID WEB REMOTE — RELATÓRIO DE DIAGNÓSTICO
Versão: ${context.packageManager.getPackageInfo(context.packageName, 0).versionName}
Revisão: ${BuildConfig.BUILD_REVISION.take(12)}
Android: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})
Fabricante e modelo: ${Build.MANUFACTURER} ${Build.MODEL}
Servidor: ${if (State.running) "Ativo" else "Desativado"}
Captura: $capture
Quadros produzidos nesta sessão: ${State.framesProduced}
Acessibilidade: ${if (ControlService.instance != null) "Serviço conectado" else "Serviço não conectado"}
Navegador: $browser
Último comando: ${State.lastInput}
Último erro registrado: ${State.lastError}
Atualizações: ${State.updateStatus}

Observação: o relatório descreve sinais observados e não garante que a imagem ou os gestos funcionem corretamente no navegador. Não inclui imagem, conteúdo digitado, IP, código de pareamento ou token.
""".trimIndent()
    }
    fun checkUpdates() {
        State.updateStatus = "Consultando GitHub..."
        Thread {
            var connection: HttpURLConnection? = null
            try {
                val url = URL("https://api.github.com/repos/MegaDev13/gua/actions/workflows/android-web-remote.yml/runs?branch=android-web-remote-build&status=success&per_page=1")
                connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 10000; connection.readTimeout = 10000
                connection.setRequestProperty("Accept", "application/vnd.github+json")
                connection.setRequestProperty("User-Agent", "AndroidWebRemote-Diagnostics")
                if (connection.responseCode != 200) throw IllegalStateException("Resposta HTTP ${connection.responseCode}")
                val raw = connection.inputStream.bufferedReader().use { it.readText() }
                val runs = JSONObject(raw).getJSONArray("workflow_runs")
                if (runs.length() == 0) { State.updateStatus = "Nenhuma compilação bem-sucedida encontrada"; return@Thread }
                val revision = runs.getJSONObject(0).getString("head_sha")
                State.updateStatus = if (BuildConfig.BUILD_REVISION == "local") "Versão instalada sem revisão de compilação; não é possível comparar" else if (revision == BuildConfig.BUILD_REVISION) "Esta é a última compilação bem-sucedida" else "Há uma compilação mais recente; instalação automática ainda não disponível"
            } catch (e: Exception) {
                State.updateStatus = "Não foi possível consultar atualizações (${e.javaClass.simpleName})"
            } finally { connection?.disconnect() }
        }.start()
    }
}
