package br.com.androidwebremote

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class ControlService : AccessibilityService() {
    companion object { @Volatile var instance: ControlService? = null }
    override fun onServiceConnected() { instance = this }
    override fun onDestroy() { instance = null; super.onDestroy() }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
    fun gesture(x1: Float, y1: Float, x2: Float, y2: Float, duration: Long) {
        val w = resources.displayMetrics.widthPixels.toFloat(); val h = resources.displayMetrics.heightPixels.toFloat()
        val p = Path().apply { moveTo(x1.coerceIn(0f, 1f) * (w-1), y1.coerceIn(0f, 1f) * (h-1)); lineTo(x2.coerceIn(0f, 1f) * (w-1), y2.coerceIn(0f, 1f) * (h-1)) }
        dispatchGesture(GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(p, 0, duration.coerceIn(50, 2000))).build(), null, null)
    }
    fun text(value: String): Boolean {
        val node = findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value) })
    }
}
