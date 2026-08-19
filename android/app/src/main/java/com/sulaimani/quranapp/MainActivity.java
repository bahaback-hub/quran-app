package com.sulaimani.quranapp;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Native Android host for the Capacitor reader.
 *
 * Design note: Android 15+ forces edge-to-edge for apps targeting modern SDKs.
 * The WebView therefore receives real system-bar and display-cutout insets here,
 * rather than relying on the deprecated StatusBar overlay configuration.
 */
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the app edge-to-edge at the window level, but reserve every unsafe
        // system area inside the WebView. This keeps headers, controls and content
        // out from beneath the clock, camera cutout, battery and navigation bar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }

        webView.setBackgroundColor(Color.rgb(245, 240, 232));
        webView.setClipToPadding(false);

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets safeArea = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(safeArea.left, safeArea.top, safeArea.right, safeArea.bottom);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
