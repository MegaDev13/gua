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
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.res.painterResource
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
            LaunchedEffect(Unit) { Updater.check(this@MainActivity); while (true) { delay(500); tick++ } }
            MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFF70E0EB), background = Color(0xFF0B1222), surface = Color(0xFF111C31), onSurface = Color(0xFFE8F2FF))) {
              Surface(Modifier.fillMaxSize()) {
              Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Color(0xFF1B3556), Color(0xFF151E38))), RoundedCornerShape(24.dp)).padding(22.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Image(painterResource(R.drawable.ic_remote), contentDescription = "Ícone Web Remote", modifier = Modifier.size(64.dp))
                    Text("ANDROID", color = Color(0xFF88EAF0), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Text("Web Remote", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("Seu celular ao alcance do navegador", color = Color(0xFFC0D3E9), style = MaterialTheme.typography.bodyMedium)
                }
                Text("EXPERIMENTAL • REDE LOCAL", color = Color(0xFF83DEEA), style = MaterialTheme.typography.labelMedium)
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
                OutlinedButton(onClick = { Updater.check(this@MainActivity) }) { Text("Verificar atualizações") }
                if (Updater.ready) {
                    Button(onClick = { Updater.install(this@MainActivity) }) { Text("Instalar atualização") }
                }
                OutlinedButton(onClick = {
                    val report = Diagnostics.report(this@MainActivity)
                    val share = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, report)
                    startActivity(Intent.createChooser(share, "Compartilhar diagnóstico"))
                }) { Text("Compartilhar relatório de diagnóstico") }
                Text("Selecione compartilhar a tela inteira. Rotação e conexões via internet ainda não são suportadas.")
            } } }
        }
    }
    private fun localIp(): String = try {
        NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback }.flatMap { it.inetAddresses.toList() }.filterIsInstance<Inet4Address>().firstOrNull { it.isSiteLocalAddress }?.hostAddress ?: "indisponível"
    } catch (_: Exception) { "indisponível" }
}
