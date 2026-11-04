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
}
