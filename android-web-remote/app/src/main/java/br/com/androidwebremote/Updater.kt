package br.com.androidwebremote

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

object Updater {
    @Volatile var ready = false
    private val checking = AtomicBoolean(false)
    private const val maxSize = 80L * 1024 * 1024
    private fun path(ctx: Context) = File(ctx.cacheDir, "updates/android-web-remote.apk")
    private fun http(url: String): HttpURLConnection {
        require(url.startsWith("https://"))
        return (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000; readTimeout = 30000
            setRequestProperty("User-Agent", "AndroidWebRemote-Updater")
            setRequestProperty("Accept", "application/vnd.github+json")
        }
    }
    private fun certs(info: PackageInfo): List<String> {
        val signs = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else @Suppress("DEPRECATION") info.signatures
        return signs?.map { MessageDigest.getInstance("SHA-256").digest(it.toByteArray()).joinToString("") { b -> "%02x".format(b.toInt() and 255) } }?.sorted() ?: emptyList()
    }
    private fun version(info: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
    fun check(context: Context) {
        if (!checking.compareAndSet(false, true)) return
        val app = context.applicationContext
        ready = false; State.updateStatus = "Consultando atualizações..."
        Thread {
            var tmp: File? = null
            try {
                val api = http("https://api.github.com/repos/MegaDev13/gua/releases/tags/android-web-remote-latest")
                val release = try {
                    if (api.responseCode == 404) { State.updateStatus = "Distribuição de atualizações ainda não configurada"; return@Thread }
                    check(api.responseCode == 200) { "Serviço indisponível" }
                    JSONObject(api.inputStream.bufferedReader().use { it.readText() })
                } finally { api.disconnect() }
                val assets = release.getJSONArray("assets")
                val asset = (0 until assets.length()).map { assets.getJSONObject(it) }.firstOrNull { it.optString("name") == "android-web-remote.apk" } ?: error("APK não publicado")
                val apkUrl = asset.getString("browser_download_url")
                require(apkUrl.startsWith("https://github.com/MegaDev13/gua/releases/download/android-web-remote-latest/"))
                require(asset.getLong("size") in 1..maxSize)
                val expected = asset.optString("digest", "").removePrefix("sha256:")
                require(expected.matches(Regex("[a-f0-9]{64}"))) { "Sem resumo de integridade" }
                val dest = path(app); dest.parentFile?.mkdirs(); val work = File(dest.parentFile, "download.tmp"); tmp = work; work.delete()
                val download = http(apkUrl)
                try {
                    check(download.responseCode == 200 && download.url.protocol == "https")
                    val hash = MessageDigest.getInstance("SHA-256"); var total = 0L
                    download.inputStream.use { input -> work.outputStream().use { output ->
                        val buf = ByteArray(32768)
                        while (true) { val n = input.read(buf); if (n < 0) break; total += n; require(total <= maxSize); hash.update(buf,0,n); output.write(buf,0,n) }
                    } }
                    check(total == asset.getLong("size"))
                    val actual = hash.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
                    check(actual == expected) { "Arquivo alterado" }
                } finally { download.disconnect() }
                val pm = app.packageManager
                val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
                val current = pm.getPackageInfo(app.packageName, flags)
                val next = pm.getPackageArchiveInfo(work.absolutePath, flags) ?: error("APK inválido")
                check(next.packageName == app.packageName && certs(current).isNotEmpty() && certs(current) == certs(next)) { "Assinatura incompatível" }
                if (version(next) <= version(current)) { State.updateStatus = "Aplicativo atualizado"; return@Thread }
                if (dest.exists()) dest.delete()
                check(work.renameTo(dest)) { "Erro ao guardar o arquivo" }; tmp = null
                ready = true; State.updateStatus = "Atualização pronta. Toque em Instalar atualização."
            } catch (e: Exception) {
                State.updateStatus = when (e.message) {
                    "Assinatura incompatível" -> "Atualização recusada: assinatura incompatível com esta instalação"
                    else -> "Não foi possível preparar a atualização (${e.javaClass.simpleName})"
                }
            } finally { tmp?.delete(); checking.set(false) }
        }.start()
    }
    fun install(context: Context) {
        if (!ready || !path(context).isFile) return
        if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
            State.updateStatus = "Permita a instalação para o Web Remote e volte ao aplicativo."
            context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")))
            return
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", path(context))
        context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
    }
}
