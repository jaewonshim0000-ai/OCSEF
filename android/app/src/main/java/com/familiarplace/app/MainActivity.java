package com.familiarplace.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LockHelpPlugin.class);
        super.onCreate(savedInstanceState);
        // Make sure "Tap for help" is on the lock screen whenever it should be.
        if (LockHelpNotifier.isEnabled(this)) LockHelpNotifier.post(this);
    }
}
