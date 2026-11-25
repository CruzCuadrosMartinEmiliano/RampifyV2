package com.example.rampifyv1;

import android.app.Application;
import android.content.SharedPreferences;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.os.LocaleListCompat;

public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        SharedPreferences prefs = getSharedPreferences("ajustes", MODE_PRIVATE);
        String language = prefs.getString("idioma", "es");
        if (!language.equals(AppCompatDelegate.getApplicationLocales().toLanguageTags())) {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(language));
        }
        AppCompatDelegate.setDefaultNightMode(prefs.getBoolean("modo_oscuro", false)
                ? AppCompatDelegate.MODE_NIGHT_YES
                : AppCompatDelegate.MODE_NIGHT_NO);
    }
}