package com.onur.neonterminal;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/* MERMER TERMİNAL v8.0 — Android Keystore wrap for the Binance API Secret record (bkeys.js ksWrap / ksUnwrap).
   - one non-exportable AES-256-GCM key (alias mermer_secret_wrap_v1) generated inside the Android Keystore (TEE / StrongBox where the phone has it)
   - wrap(data) / unwrap(ct, iv): the web layer passes ONLY the PIN-ciphertext (already AES-GCM encrypted with the user's PIN in JS),
     so this class never sees the plaintext Secret or the PIN
   - nothing is logged, nothing is stored here, no network; the key never leaves the Keystore (uninstall → key gone → user re-enters the Secret)
   - Capacitor exposes the bridge only to the app's own origin (server.url host). */
@CapacitorPlugin(name = "NeonKeystore")
public class NeonKeystorePlugin extends Plugin {
    private static final String ALIAS = "mermer_secret_wrap_v1";
    private static final int MAX = 65536;

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build());
        return g.generateKey();
    }

    private static String b64(byte[] b) { return Base64.encodeToString(b, Base64.NO_WRAP); }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        try { key(); r.put("ok", true); } catch (Exception e) { r.put("ok", false); }
        r.put("alias", ALIAS);
        call.resolve(r);
    }

    @PluginMethod
    public void wrap(PluginCall call) {
        String d = call.getString("data");
        if (d == null || d.isEmpty() || d.length() > MAX) { call.reject("geçersiz veri"); return; }
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key());
            byte[] ct = c.doFinal(d.getBytes(StandardCharsets.UTF_8));
            JSObject r = new JSObject();
            r.put("iv", b64(c.getIV()));
            r.put("ct", b64(ct));
            r.put("alias", ALIAS);
            call.resolve(r);
        } catch (Exception e) { call.reject("keystore wrap başarısız"); }
    }

    @PluginMethod
    public void unwrap(PluginCall call) {
        String ct = call.getString("ct"), iv = call.getString("iv");
        if (ct == null || iv == null || ct.length() > MAX * 2) { call.reject("geçersiz veri"); return; }
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            byte[] pt = c.doFinal(Base64.decode(ct, Base64.NO_WRAP));
            JSObject r = new JSObject();
            r.put("data", new String(pt, StandardCharsets.UTF_8));
            call.resolve(r);
        } catch (Exception e) { call.reject("keystore unwrap başarısız"); }
    }
}
