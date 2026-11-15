package com.familiarplace.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * The quiet "Familiar Place / Tap for help" notification on the lock screen.
 * Its text is generic on purpose: anyone can read a lock-screen notification.
 */
final class LockHelpNotifier {

    private static final String CHANNEL = "lock_help";
    private static final int NOTIFICATION_ID = 1;
    private static final String PREFS = "familiar_place";
    private static final String KEY_ENABLED = "lock_help";

    private LockHelpNotifier() {}

    static boolean isEnabled(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ENABLED, enabled).apply();
        if (enabled) post(context);
        else cancel(context);
    }

    static boolean canPost(Context context) {
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    static void post(Context context) {
        if (!canPost(context)) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            // Default importance so it shows on the lock screen ("silent" ones are often hidden there),
            // but with no sound or vibration.
            NotificationChannel channel =
                new NotificationChannel(CHANNEL, "Help on the lock screen", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Opens the help screen without unlocking the phone.");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableVibration(false);
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(context, LockHelpActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap =
            PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_help)
            .setContentTitle("Familiar Place")
            .setContentText("Tap for help")
            .setContentIntent(tap)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
        manager.notify(NOTIFICATION_ID, notification);
    }

    static void cancel(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
    }
}
