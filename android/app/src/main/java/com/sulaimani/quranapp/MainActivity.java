package com.sulaimani.quranapp;

import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
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
        // Register before BridgeActivity creates the bridge so the web reader can
        // receive a calibrated, screen-aware true-north heading on Android.
        registerPlugin(QiblaCompassPlugin.class);
        super.onCreate(savedInstanceState);

        // Android 15+ enforces edge-to-edge for apps targeting recent SDKs. Keep the
        // window edge-to-edge, then move the WebView itself outside every unsafe
        // system area. Margin insets are deliberate: WebView padding still lets its
        // first painted child appear beneath status-bar icons on some OEM devices.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.rgb(14, 20, 32));
        getWindow().setNavigationBarColor(Color.rgb(14, 20, 32));
        WindowInsetsControllerCompat insetsController = new WindowInsetsControllerCompat(
            getWindow(), getWindow().getDecorView()
        );
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);

        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }

        webView.setBackgroundColor(Color.rgb(245, 240, 232));
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets safeArea = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            ViewGroup.LayoutParams layoutParams = view.getLayoutParams();
            if (layoutParams instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams marginParams = (ViewGroup.MarginLayoutParams) layoutParams;
                if (marginParams.leftMargin != safeArea.left
                    || marginParams.topMargin != safeArea.top
                    || marginParams.rightMargin != safeArea.right
                    || marginParams.bottomMargin != safeArea.bottom) {
                    marginParams.setMargins(
                        safeArea.left,
                        safeArea.top,
                        safeArea.right,
                        safeArea.bottom
                    );
                    view.setLayoutParams(marginParams);
                }
                // Clear padding from the previous implementation: only true layout
                // bounds make the entire page, including the prayer bar, safe.
                view.setPadding(0, 0, 0, 0);
            } else {
                // Defensive fallback for a non-margin Capacitor host view.
                view.setPadding(safeArea.left, safeArea.top, safeArea.right, safeArea.bottom);
                if (view instanceof WebView) {
                    ((WebView) view).setClipToPadding(true);
                }
            }
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
