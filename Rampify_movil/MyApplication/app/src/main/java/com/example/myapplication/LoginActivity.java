package com.example.rampifyv1;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class LoginActivity extends AppCompatActivity {

    private EditText etCorreo, etPassword;
    private Button btnEntrar;
    private TextView tvOlvide, tvRegistrate;
    private AuthRepository authRepository;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        etCorreo = findViewById(R.id.etCorreo);
        etPassword = findViewById(R.id.etPassword);
        btnEntrar = findViewById(R.id.btnEntrar);
        tvOlvide = findViewById(R.id.tvOlvide);
        tvRegistrate = findViewById(R.id.tvRegistrate);
        authRepository = new AuthRepository(this);

        btnEntrar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String correo = etCorreo.getText().toString().trim();
                String pass = etPassword.getText().toString().trim();

                if (correo.isEmpty() || pass.isEmpty()) {
                    Toast.makeText(LoginActivity.this,
                            "Completa tus datos", Toast.LENGTH_SHORT).show();
                    return;
                }
                btnEntrar.setEnabled(false);
                new ApiClient(LoginActivity.this).login(correo, pass, (ok, status, data) ->
                        runOnUiThread(() -> {
                            btnEntrar.setEnabled(true);
                            if (ok) {
                                startActivity(new Intent(LoginActivity.this, MapaActivity.class));
                                finish();
                            } else if (status == 429) {
                                Toast.makeText(LoginActivity.this, "Cuenta bloqueada por 15 minutos", Toast.LENGTH_LONG).show();
                            } else if (status == 0) {
                                Toast.makeText(LoginActivity.this, "No fue posible conectar con el servidor", Toast.LENGTH_LONG).show();
                            } else {
                                Toast.makeText(LoginActivity.this, "Correo o contraseña incorrectos", Toast.LENGTH_SHORT).show();
                            }
                        }));
            }
        });

        tvRegistrate.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(LoginActivity.this, RegistroActivity.class);
                startActivity(intent);
            }
        });

        tvOlvide.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(LoginActivity.this, RecuperarPasswordActivity.class));
            }
        });
    }
}