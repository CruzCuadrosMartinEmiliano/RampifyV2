package com.example.rampifyv1;

import android.content.Intent;
import android.os.Bundle;
import android.util.Patterns;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class RegistroActivity extends AppCompatActivity {

    private EditText etNombre, etCorreo, etPassword;
    private CheckBox cbPrivacidad;
    private Button btnCrearCuenta;
    private TextView tvIniciarSesion;
    private AuthRepository authRepository;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_registro);

        etNombre = findViewById(R.id.etNombre);
        etCorreo = findViewById(R.id.etCorreo);
        etPassword = findViewById(R.id.etPassword);
        cbPrivacidad = findViewById(R.id.cbPrivacidad);
        btnCrearCuenta = findViewById(R.id.btnCrearCuenta);
        tvIniciarSesion = findViewById(R.id.tvIniciarSesion);
        authRepository = new AuthRepository(this);

        btnCrearCuenta.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (!datosValidos()) {
                    return;
                }

                String nombre = etNombre.getText().toString().trim();

                btnCrearCuenta.setEnabled(false);
                new ApiClient(RegistroActivity.this).register(nombre,
                        etCorreo.getText().toString().trim(),
                        etPassword.getText().toString(),
                        (ok, status, data) -> runOnUiThread(() -> {
                            btnCrearCuenta.setEnabled(true);
                            if (ok) {
                                Toast.makeText(RegistroActivity.this, "Cuenta creada. Inicia sesión para continuar", Toast.LENGTH_LONG).show();
                                startActivity(new Intent(RegistroActivity.this, LoginActivity.class));
                                finish();
                            } else if (status == 409) {
                                etCorreo.setError("El correo ya se encuentra registrado");
                            } else {
                                Toast.makeText(RegistroActivity.this, status == 0 ? "No fue posible conectar con el servidor" : "No se pudo crear la cuenta", Toast.LENGTH_LONG).show();
                            }
                        }));
            }
        });

        tvIniciarSesion.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(RegistroActivity.this, LoginActivity.class);
                startActivity(intent);
                finish();
            }
        });
    }

    private boolean datosValidos() {
        String nombre = etNombre.getText().toString().trim();
        String correo = etCorreo.getText().toString().trim();
        String pass = etPassword.getText().toString().trim();

        boolean valido = true;

        // Nombre: mínimo 3 caracteres, solo letras y espacios
        if (nombre.isEmpty()) {
            etNombre.setError("Escribe tu nombre");
            valido = false;
        } else if (nombre.length() < 2) {
            etNombre.setError("El nombre debe tener al menos 2 caracteres");
            valido = false;
        } else if (!nombre.matches("[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ ]+")) {
            etNombre.setError("El nombre solo puede contener letras");
            valido = false;
        }


        // Correo: formato válido
        if (correo.isEmpty()) {
            etCorreo.setError("Escribe tu correo");
            valido = false;
        } else if (!Patterns.EMAIL_ADDRESS.matcher(correo).matches()) {
            etCorreo.setError("Correo no válido (ej. nombre@correo.com)");
            valido = false;
        }

        // Contraseña: mínimo 8 caracteres
        if (pass.isEmpty()) {
            etPassword.setError("Escribe una contraseña");
            valido = false;
        } else if (!pass.matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,64}$")) {
            etPassword.setError("Usa 8-64 caracteres, mayúscula, minúscula y número");
            valido = false;
        }

        // Si hay errores en campos, no seguimos con el CheckBox
        if (!valido) {
            return false;
        }

        if (!cbPrivacidad.isChecked()) {
            Toast.makeText(this,
                    "Debes aceptar los Términos y el Aviso de privacidad",
                    Toast.LENGTH_SHORT).show();
            return false;
        }

        return true;
    }
}