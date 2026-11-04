package br.com.androidwebremote

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import java.io.ByteArrayOutputStream

class RemoteService : Service() {
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var server: WebServer? = null
    private var lastFrame = 0L
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "stop") { stopSelf(); return START_NOT_STICKY }
        if (State.running) return START_NOT_STICKY
        try {
            val data = (if (Build.VERSION.SDK_INT >= 33) intent?.getParcelableExtra("data", Intent::class.java) else @Suppress("DEPRECATION") intent?.getParcelableExtra<Intent>("data"))
                ?: throw IllegalArgumentException("Sem autorização de captura")
            val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(NotificationChannel("remote", "Compartilhamento de tela", NotificationManager.IMPORTANCE_LOW))
            val stop = PendingIntent.getService(this, 0, Intent(this, RemoteService::class.java).setAction("stop"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val notification = Notification.Builder(this, "remote").setSmallIcon(android.R.drawable.ic_menu_view).setContentTitle("Compartilhamento de tela ativo").setContentText("Android Web Remote em execução").addAction(Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "Encerrar", stop).build()).build()
            if (Build.VERSION.SDK_INT >= 29) startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION) else startForeground(1, notification)
            State.reset()
            val metrics = resources.displayMetrics
            State.width = metrics.widthPixels; State.height = metrics.heightPixels
            val scale = minOf(1.0, 720.0 / minOf(State.width, State.height))
            val w = (State.width * scale).toInt().coerceAtLeast(1); val h = (State.height * scale).toInt().coerceAtLeast(1)
            reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
            reader!!.setOnImageAvailableListener({ source ->
                val image = source.acquireLatestImage() ?: return@setOnImageAvailableListener
                try {
                    if (State.approved && System.currentTimeMillis() < State.expires && System.currentTimeMillis() - lastFrame > 180) {
                        lastFrame = System.currentTimeMillis()
                        val plane = image.planes[0]; val pad = plane.rowStride - plane.pixelStride * w
                        val bmp = Bitmap.createBitmap(w + pad / plane.pixelStride, h, Bitmap.Config.ARGB_8888)
                        bmp.copyPixelsFromBuffer(plane.buffer)
                        val crop = Bitmap.createBitmap(bmp, 0, 0, w, h)
                        val out = ByteArrayOutputStream(); crop.compress(Bitmap.CompressFormat.JPEG, 65, out); State.frame = out.toByteArray()
                        if (crop !== bmp) crop.recycle(); bmp.recycle()
                    }
                } finally { image.close() }
            }, Handler(Looper.getMainLooper()))
            projection = (getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager).getMediaProjection(intent?.getIntExtra("resultCode", Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED, data)
            projection!!.registerCallback(object : MediaProjection.Callback() { override fun onStop() { stopSelf() } }, Handler(Looper.getMainLooper()))
            display = projection!!.createVirtualDisplay("Android Web Remote", w, h, metrics.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader!!.surface, null, null)
            server = WebServer(this).also { it.start() }
            State.running = true; State.message = "Servidor ativo: aguardando navegador"
        } catch (e: Exception) { State.message = "Falha ao iniciar: ${e.message}"; stopSelf() }
        return START_NOT_STICKY
    }
    override fun onDestroy() {
        State.running = false; server?.stop(); server = null; display?.release(); display = null; reader?.close(); reader = null
        val old = projection; projection = null; old?.stop(); State.reset(); State.message = "Desconectado"; super.onDestroy()
    }
}
