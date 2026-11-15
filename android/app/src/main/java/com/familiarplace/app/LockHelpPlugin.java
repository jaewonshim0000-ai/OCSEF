package com.familiarplace.app;

import android.Manifest;
import android.app.Activity;
import android.app.KeyguardManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Lets the web app turn lock-screen help on and off, and leave over-lock mode. See src/lib/lockHelp.ts. */
@CapacitorPlugin(
    name = "LockHelp",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class LockHelpPlugin extends Plugin {

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (!enabled) {
            LockHelpNotifier.setEnabled(getContext(), false);
            resolveEnabled(call, false);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationsAnswered");
            return;
        }
        enable(call);
    }

    @PermissionCallback
    private void notificationsAnswered(PluginCall call) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            enable(call);
        } else {
            LockHelpNotifier.setEnabled(getContext(), false);
            resolveEnabled(call, false);
        }
    }

    private void enable(PluginCall call) {
        LockHelpNotifier.setEnabled(getContext(), true);
        resolveEnabled(call, LockHelpNotifier.canPost(getContext()));
    }

    private static void resolveEnabled(PluginCall call, boolean enabled) {
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void isOverLock(PluginCall call) {
        // Fail closed: inside LockHelpActivity always means over-lock, even if the phone was
        // unlocked while the page loaded (the activity can still show over the lock screen later).
        // Tapping the notification on an unlocked phone never gets here: onCreate opens the main app.
        boolean overLock = getActivity() instanceof LockHelpActivity;
        JSObject result = new JSObject();
        result.put("overLock", overLock);
        call.resolve(result);
    }

    @PluginMethod
    public void requestUnlock(PluginCall call) {
        Activity activity = getActivity();
        KeyguardManager keyguard = getContext().getSystemService(KeyguardManager.class);
        if (keyguard == null || !keyguard.isKeyguardLocked()) {
            LockHelpActivity.openMainApp(activity);
            call.resolve();
            return;
        }
        if (Build.VERSION.SDK_INT < 26) {
            // ponytail: Android 7 has no unlock prompt API; the person unlocks the phone themselves.
            call.resolve();
            return;
        }
        activity.runOnUiThread(() ->
            keyguard.requestDismissKeyguard(activity, new KeyguardManager.KeyguardDismissCallback() {
                @Override
                public void onDismissSucceeded() {
                    LockHelpActivity.openMainApp(activity);
                    call.resolve();
                }

                @Override
                public void onDismissCancelled() {
                    call.resolve();
                }

                @Override
                public void onDismissError() {
                    call.resolve();
                }
            })
        );
    }
}
