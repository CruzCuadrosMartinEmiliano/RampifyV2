package com.example.rampifyv1;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.CompoundButton;
import android.widget.Switch;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;

public class VistaActivity extends AppCompatActivity {

    private TextView tvVolver;
    private Switch swModoOscuro;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vista);

        tvVolver = findViewById(R.id.tvVolver);
        swModoOscuro = findViewById(R.id.swModoOscuro);

        final SharedPreferences prefs = getSharedPreferences("ajustes", MODE_PRIVATE);
        swModoOscuro.setChecked(prefs.getBoolean("modo_oscuro", false));

        swModoOscuro.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean activado) {
                prefs.edit().putBoolean("modo_oscuro", activado).apply();
                AppCompatDelegate.setDefaultNightMode(activado
                        ? AppCompatDelegate.MODE_NIGHT_YES
                        : AppCompatDelegate.MODE_NIGHT_NO);
            }
        });

        tvVolver.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
    }
}