package com.familiarplace.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Puts "Tap for help" back on the lock screen after a restart or an app update. */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        boolean relevant = Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action);
        if (relevant && LockHelpNotifier.isEnabled(context)) LockHelpNotifier.post(context);
    }
}
