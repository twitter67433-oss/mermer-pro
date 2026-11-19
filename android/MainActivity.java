package com.onur.neonterminal;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /* v7.26: status / navigation bars in the marble theme colour (#EFE9DD, same as <meta theme-color>) with dark icons.
       On Android 15+ (edge-to-edge) the bar colour is drawn by the window background behind the bars. */
    private static final int MARBLE = Color.parseColor("#EFE9DD");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NeonKeystorePlugin.class); /* v8.0: Android Keystore wrap for the API Secret (must be before super.onCreate) */
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.getDecorView().setBackgroundColor(MARBLE);
        w.setStatusBarColor(MARBLE);
        w.setNavigationBarColor(MARBLE);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
        c.setAppearanceLightStatusBars(true);
        c.setAppearanceLightNavigationBars(true);
    }
}
