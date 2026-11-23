package com.example.rampifyv1;

import android.content.Context;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ApiClient {
    public interface Callback {
        void onComplete(boolean ok, int status, JSONObject data);
    }

    private final Context context;
    private final RampifyDatabase database;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public ApiClient(Context context) {
        this.context = context.getApplicationContext();
        this.database = new RampifyDatabase(this.context);
    }

    public void login(String email, String password, Callback callback) {
        JSONObject body = new JSONObject();
        try {
            body.put("correo", email);
            body.put("contrasena", password);
        } catch (Exception exception) {
            callback.onComplete(false, 0, new JSONObject());
            return;
        }
        post("/api/v1/auth/login", body, (ok, status, data) -> {
            if (ok) {
                try {
                    JSONObject user = data.getJSONObject("usuario");
                    database.saveSession(data.getString("token"), user.getString("correo"), user.getString("nombre"));
                } catch (Exception exception) {
                    callback.onComplete(false, status, data);
                    return;
                }
            }
            callback.onComplete(ok, status, data);
        });
    }

    public void register(String name, String email, String password, Callback callback) {
        JSONObject body = new JSONObject();
        try {
            body.put("nombre", name);
            body.put("correo", email);
            body.put("contrasena", password);
        } catch (Exception exception) {
            callback.onComplete(false, 0, new JSONObject());
            return;
        }
        post("/api/v1/auth/registro", body, callback);
    }

    public void logout() {
        database.clearSession();
    }

    private void post(String path, JSONObject body, Callback callback) {
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(BuildConfig.API_BASE_URL + path);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
                int status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String response = read(stream);
                JSONObject data;
                try {
                    data = new JSONObject(response);
                } catch (Exception exception) {
                    data = new JSONObject();
                }
                callback.onComplete(status >= 200 && status < 300, status, data);
            } catch (Exception exception) {
                callback.onComplete(false, 0, new JSONObject());
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private static String read(InputStream stream) throws Exception {
        if (stream == null) return "{}";
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }
}
