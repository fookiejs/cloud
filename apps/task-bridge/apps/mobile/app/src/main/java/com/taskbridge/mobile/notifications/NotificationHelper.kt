package com.taskbridge.mobile.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.taskbridge.mobile.MainActivity
import com.taskbridge.mobile.R
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.taskbridge.mobile.domain.models.InboxItem

class NotificationHelper(private val context: Context) {
    fun showAnswerReady(item: InboxItem) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        ensureChannel()
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_TASK_ID, item.taskId)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            item.taskId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val preview = item.preview?.take(120)?.takeIf { it.isNotBlank() } ?: "Tap to read"
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Answer ready")
            .setContentText(item.title)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$preview\n\n${item.title}"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        NotificationManagerCompat.from(context).notify(item.taskId, notification)
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Answers",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Task Bridge answer notifications"
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "task_bridge_answers"
        const val EXTRA_TASK_ID = "taskId"
    }
}
