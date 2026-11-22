package com.example.rampifyv1;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.view.View;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

public class MenuInferior {

    public static final int MAPA = 0;
    public static final int HISTORIAL = 1;
    public static final int PERFIL = 2;

    public static void configurar(final Activity activity, final int activo) {
        TextView btnMapa = activity.findViewById(R.id.btnMenuMapa);
        TextView btnHistorial = activity.findViewById(R.id.btnMenuHistorial);
        TextView btnPerfil = activity.findViewById(R.id.btnMenuPerfil);

        marcar(activity, btnMapa, activo == MAPA);
        marcar(activity, btnHistorial, activo == HISTORIAL);
        marcar(activity, btnPerfil, activo == PERFIL);

        btnMapa.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (activo != MAPA) {
                    Intent intent = new Intent(activity, MapaActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    activity.startActivity(intent);
                }
            }
        });

        btnHistorial.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (activo != HISTORIAL) {
                    activity.startActivity(new Intent(activity, HistorialActivity.class));
                    if (activo != MAPA) activity.finish();
                }
            }
        });

        btnPerfil.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (activo != PERFIL) {
                    activity.startActivity(new Intent(activity, PerfilActivity.class));
                    if (activo != MAPA) activity.finish();
                }
            }
        });
    }

    private static void marcar(Activity activity, TextView tv, boolean activo) {
        int color = ContextCompat.getColor(activity,
                activo ? R.color.app_primary : R.color.app_on_surface_variant);
        tv.setTextColor(color);
        tv.setCompoundDrawableTintList(ColorStateList.valueOf(color));
    }
}