package br.com.androidwebremote

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import java.net.NetworkInterface
import java.net.Inet4Address

class MainActivity : ComponentActivity() {
    private val capture = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val intent = Intent(this, RemoteService::class.java).putExtra("resultCode", result.resultCode).putExtra("data", result.data)
            startForegroundService(intent)
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            var tick by remember { mutableIntStateOf(0) }
            LaunchedEffect(Unit) { Diagnostics.checkUpdates(); while (true) { delay(500); tick++ } }
            MaterialTheme { Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("ANDROID WEB REMOTE", style = MaterialTheme.typography.headlineSmall)
                Text("Experimental • somente rede local confiável")
                Text(if (tick >= 0) State.message else "")
                Text("Endereço: http://${localIp()}:8080")
                Text("Código temporário: ${if (State.running) State.code else "—"}")
                Text("HTTP não é criptografado. Não exponha à internet e não use em redes públicas.")
                Button(onClick = { if (!State.running) capture.launch((getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager).createScreenCaptureIntent()) }, enabled = !State.running) { Text("Iniciar compartilhamento") }
                Button(onClick = { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }) { Text("Ativar acessibilidade") }
                if (State.pending) {
                    Text("Um navegador solicitou controle. Autorize apenas se for seu.")
                    Button(onClick = { State.approve() }) { Text("Autorizar navegador") }
                    OutlinedButton(onClick = { State.reset() }) { Text("Recusar e trocar código") }
                }
                OutlinedButton(onClick = { stopService(Intent(this@MainActivity, RemoteService::class.java)) }, enabled = State.running) { Text("Encerrar sessão") }
                HorizontalDivider()
                Text("Diagnóstico e atualizações", style = MaterialTheme.typography.titleMedium)
                Text(State.updateStatus)
                OutlinedButton(onClick = { Diagnostics.checkUpdates() }) { Text("Verificar atualizações") }
                OutlinedButton(onClick = {
                    val report = Diagnostics.report(this@MainActivity)
                    val share = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, report)
                    startActivity(Intent.createChooser(share, "Compartilhar diagnóstico"))
                }) { Text("Compartilhar relatório de diagnóstico") }
                Text("Selecione compartilhar a tela inteira. Rotação e conexões via internet ainda não são suportadas.")
            } }
        }
    }
    private fun localIp(): String = try {
        NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback }.flatMap { it.inetAddresses.toList() }.filterIsInstance<Inet4Address>().firstOrNull { it.isSiteLocalAddress }?.hostAddress ?: "indisponível"
    } catch (_: Exception) { "indisponível" }
}
