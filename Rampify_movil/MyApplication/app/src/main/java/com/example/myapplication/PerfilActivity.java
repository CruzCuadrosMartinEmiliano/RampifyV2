package com.example.rampifyv1;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;
import android.content.Intent;

import androidx.appcompat.app.AppCompatActivity;

public class PerfilActivity extends AppCompatActivity {

    private TextView tvInicial, tvNombrePerfil;
    private TextView opCuenta, opVista, opNotificaciones, opAcerca;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_perfil);

        tvInicial = findViewById(R.id.tvInicial);
        tvNombrePerfil = findViewById(R.id.tvNombrePerfil);
        opCuenta = findViewById(R.id.opCuenta);
        opVista = findViewById(R.id.opVista);
        opNotificaciones = findViewById(R.id.opNotificaciones);
        opAcerca = findViewById(R.id.opAcerca);

        MenuInferior.configurar(this, MenuInferior.PERFIL);

        String nombre = getIntent().getStringExtra("nombre");
        if (nombre == null || nombre.isEmpty()) {
            nombre = new AuthRepository(this).getName();
        }
        if (nombre != null && !nombre.isEmpty()) {
            tvNombrePerfil.setText(nombre);
            tvInicial.setText(nombre.substring(0, 1).toUpperCase());
        }

        opCuenta.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(PerfilActivity.this, CuentaActivity.class));
            }
        });
        opVista.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(PerfilActivity.this, VistaActivity.class));
            }
        });
        opNotificaciones.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(PerfilActivity.this, NotificacionesActivity.class));
            }
        });
        opAcerca.setOnClickListener(avisoProximamente("Acerca de"));
    }


    private View.OnClickListener avisoProximamente(final String seccion) {
        return new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Toast.makeText(PerfilActivity.this,
                        seccion + ": próximamente", Toast.LENGTH_SHORT).show();
            }
        };
    }
}