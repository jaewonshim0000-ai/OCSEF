package com.familiarplace.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

/**
 * Opened from the "Tap for help" notification. It is allowed to show over the
 * phone's lock screen (android:showWhenLocked in the manifest), so it runs the
 * web app in over-lock mode, where only the locked help views can show. The
 * main activity never shows over the lock screen.
 */
public class LockHelpActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LockHelpPlugin.class);
        if (Build.VERSION.SDK_INT < 27) {
            // ponytail: Android 7 to 8.0 use the old window flag; some may still ask to unlock first.
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
        }
        super.onCreate(savedInstanceState);
        KeyguardManager keyguard = getSystemService(KeyguardManager.class);
        if (keyguard == null || !keyguard.isKeyguardLocked()) {
            // Tapped on an unlocked phone: the normal app is the right place.
            openMainApp(this);
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        // Never keep a help screen around: the next tap starts fresh, with current data
        // (e.g. items the helper has since hidden) and a fresh lock check in onCreate.
        if (!isChangingConfigurations()) finish();
    }

    static void openMainApp(Activity from) {
        Intent intent = new Intent(from, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        from.startActivity(intent);
        if (from instanceof LockHelpActivity) from.finish();
    }
}
