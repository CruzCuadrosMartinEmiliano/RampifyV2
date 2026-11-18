package com.example.rampifyv1;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.CompoundButton;
import android.widget.Switch;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class NotificacionesActivity extends AppCompatActivity {

    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notificaciones);

        prefs = getSharedPreferences("ajustes", MODE_PRIVATE);

        TextView tvVolver = findViewById(R.id.tvVolver);
        tvVolver.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        configurar((Switch) findViewById(R.id.swEstado), "notif_estado", true);
        configurar((Switch) findViewById(R.id.swCercanos), "notif_cercanos", true);
        configurar((Switch) findViewById(R.id.swSolicitudes), "notif_solicitudes", true);
        configurar((Switch) findViewById(R.id.swNovedades), "notif_novedades", false);
    }

    private void configurar(Switch sw, final String clave, boolean porDefecto) {
        sw.setChecked(prefs.getBoolean(clave, porDefecto));
        sw.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean activado) {
                prefs.edit().putBoolean(clave, activado).apply();
            }
        });
    }
}