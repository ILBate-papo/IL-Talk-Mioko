package com.iltalk.mioko;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String HOME = "https://ilbate-papo.github.io/IL-Talk-Mioko/";
    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady;
    private String voiceScript = "";
    private PermissionRequest pendingPermission;
    private ValueCallback<Uri[]> pendingFile;

    private boolean trusted(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && "ilbate-papo.github.io".equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getPath() != null && uri.getPath().startsWith("/IL-Talk-Mioko/");
    }
    private boolean trustedPage() { return web != null && web.getUrl() != null && trusted(Uri.parse(web.getUrl())); }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack);
        }
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        setContentView(web);
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " ILTalkMioko/1.0");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        try (java.io.InputStream input = getAssets().open("native-voice.js"); java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            voiceScript = new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
        catch (Exception ignored) { }
        boolean bridgeSupported = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "MiokoVoiceBridge", Collections.singleton("https://ilbate-papo.github.io"), (view, message, origin, mainFrame, reply) -> {
                if (!mainFrame || !trustedPage() || !"https".equals(origin.getScheme()) || !"ilbate-papo.github.io".equals(origin.getHost())) return;
                try { handleVoice(new JSONObject(message.getData())); } catch (Exception ignored) { }
            });
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                WebViewCompat.addDocumentStartJavaScript(web, voiceScript, Collections.singleton("https://ilbate-papo.github.io"));
            }
        }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (trusted(request.getUrl())) return false;
                if (request.isForMainFrame() && request.hasGesture()) openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!trustedPage()) return;
                if (bridgeSupported) web.evaluateJavascript(voiceScript, ignored -> sendVoices());
                else Toast.makeText(MainActivity.this, "Atualize o Android System WebView para usar a voz da Mioko.", Toast.LENGTH_LONG).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> askMediaPermission(request));
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingPermission == request) pendingPermission = null;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!trustedPage()) return false;
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                try { startActivityForResult(params.createIntent(), 102); }
                catch (Exception e) { pendingFile.onReceiveValue(null); pendingFile = null; }
                return true;
            }
        });
        tts = new TextToSpeech(this, status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (ttsReady) {
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { voiceEvent(id, "start", null); }
                    @Override public void onDone(String id) { voiceEvent(id, "end", null); }
                    @Override public void onError(String id) { voiceEvent(id, "error", "Falha na voz do Android"); }
                    @Override public void onStop(String id, boolean interrupted) { voiceEvent(id, "end", null); }
                    @Override public void onRangeStart(String id, int start, int end, int frame) {
                        try { JSONObject e = new JSONObject().put("id", id).put("type", "boundary").put("start", start); emit(e); } catch (Exception ignored) { }
                    }
                });
                sendVoices();
            }
        });
        web.loadUrl(HOME);
    }

    private void openExternal(Uri uri) {
        if (!"https".equals(uri.getScheme())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
    }
    private void askMediaPermission(PermissionRequest request) {
        if (!trustedPage() || !"https".equals(request.getOrigin().getScheme()) || !"ilbate-papo.github.io".equals(request.getOrigin().getHost())) { request.deny(); return; }
        if (pendingPermission != null) { request.deny(); return; }
        ArrayList<String> needed = new ArrayList<>();
        for (String resource : request.getResources()) {
            String permission = resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE) ? Manifest.permission.RECORD_AUDIO
                : resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE) ? Manifest.permission.CAMERA : null;
            if (permission != null && checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) needed.add(permission);
        }
        if (needed.isEmpty()) { grantMedia(request); return; }
        pendingPermission = request;
        requestPermissions(needed.toArray(new String[0]), 101);
    }
    private void grantMedia(PermissionRequest request) {
        ArrayList<String> granted = new ArrayList<>();
        if (trustedPage()) for (String resource : request.getResources()) {
            if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) granted.add(resource);
            if (resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE) && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) granted.add(resource);
        }
        if (granted.isEmpty()) request.deny(); else request.grant(granted.toArray(new String[0]));
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 101 && pendingPermission != null) { PermissionRequest request = pendingPermission; pendingPermission = null; grantMedia(request); }
    }
    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == 102 && pendingFile != null) { pendingFile.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data)); pendingFile = null; }
    }
    private void handleVoice(JSONObject message) throws Exception {
        String action = message.optString("action");
        if (action.equals("voices")) { sendVoices(); return; }
        if (action.equals("cancel")) { if (tts != null) tts.stop(); return; }
        if (!action.equals("speak")) return;
        String id = message.optString("id"), text = message.optString("text");
        if (!ttsReady || text.isEmpty() || text.length() > 6000 || id.length() > 80) { voiceEvent(id, "error", "Voz do Android indisponível"); return; }
        Locale language = Locale.forLanguageTag(message.optString("lang", "pt-BR"));
        int availability = tts.setLanguage(language);
        if (availability < TextToSpeech.LANG_AVAILABLE) { voiceEvent(id, "error", "Instale a voz desse idioma nas configurações de fala do Android"); return; }
        String voiceName = message.optString("voice");
        if (tts.getVoices() != null) for (Voice voice : tts.getVoices()) if (voice.getName().equals(voiceName)) { tts.setVoice(voice); break; }
        tts.setSpeechRate((float)Math.max(0.5, Math.min(2, message.optDouble("rate", 1))));
        tts.setPitch((float)Math.max(0.5, Math.min(2, message.optDouble("pitch", 1))));
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), id) == TextToSpeech.ERROR) voiceEvent(id, "error", "Não foi possível iniciar a voz do Android");
    }
    private void sendVoices() {
        if (!ttsReady || tts == null) return;
        try {
            JSONArray list = new JSONArray();
            if (tts.getVoices() != null) for (Voice voice : tts.getVoices()) {
                if (voice.getFeatures() != null && voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                list.put(new JSONObject().put("name", voice.getName()).put("voiceURI", voice.getName()).put("lang", voice.getLocale().toLanguageTag()).put("localService", !voice.isNetworkConnectionRequired()).put("default", voice.equals(tts.getDefaultVoice())));
            }
            emit(new JSONObject().put("type", "voices").put("voices", list));
        } catch (Exception ignored) { }
    }
    private void voiceEvent(String id, String type, String error) {
        try { JSONObject e = new JSONObject().put("id", id).put("type", type); if (error != null) e.put("error", error); emit(e); } catch (Exception ignored) { }
    }
    private void emit(JSONObject event) {
        runOnUiThread(() -> { if (trustedPage()) web.evaluateJavascript("window.__miokoNativeEvent && window.__miokoNativeEvent(" + event.toString() + ");", null); });
    }
    private void navigateBack() { if (web != null && web.canGoBack()) web.goBack(); else finish(); }
    // Android 13+ uses the native predictive-back callback registered above.
    // This override serves Android 8 through 12 only.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { navigateBack(); }
    @Override protected void onPause() {
        if (trustedPage()) web.evaluateJavascript("window.dispatchEvent(new Event('pagehide'));", null);
        if (tts != null) tts.stop();
        web.onPause();
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (pendingPermission != null) pendingPermission.deny();
        if (pendingFile != null) pendingFile.onReceiveValue(null);
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
