package app.kaplya;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

/** Окно приложения: показывает игру или тренажёр «Капли» из встроенных файлов. Работает без интернета. */
public class MainActivity extends Activity {
    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFF08080A);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // сохранение рекордов и оценок
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);                    // крупный шрифт в системе не ломает вёрстку игр
        s.setAllowFileAccess(true);             // 3D-модели и картинки лежат внутри APK
        s.setAllowFileAccessFromFileURLs(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "KaplyaNative");
        setContentView(web);

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.UK);
                if (r < 0) r = tts.setLanguage(Locale.US);
                tts.setSpeechRate(0.85f);
                ttsReady = r >= 0;
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/apps/" + BuildConfig.APP_DIR + "/index.html");
    }

    /** Мост для JavaScript: озвучка английских слов голосом телефона. */
    class Bridge {
        @JavascriptInterface
        public void speak(String text) {
            if (ttsReady && text != null) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "kaplya");
        }
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }
}
