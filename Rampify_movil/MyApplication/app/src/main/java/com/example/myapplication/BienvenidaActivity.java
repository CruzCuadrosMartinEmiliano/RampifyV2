package com.example.rampifyv1;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;

import androidx.appcompat.app.AppCompatActivity;

public class BienvenidaActivity extends AppCompatActivity {

    private Button btnCrearCuenta, btnYaTengoCuenta;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_bienvenida);

        btnCrearCuenta = findViewById(R.id.btnCrearCuenta);
        btnYaTengoCuenta = findViewById(R.id.btnYaTengoCuenta);

        btnCrearCuenta.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(BienvenidaActivity.this, RegistroActivity.class));
            }
        });

        btnYaTengoCuenta.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(BienvenidaActivity.this, LoginActivity.class));
            }
        });
    }
}