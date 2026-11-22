package com.example.rampifyv1;

import android.os.Bundle;
import android.util.Patterns;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class RecuperarPasswordActivity extends AppCompatActivity {

    private EditText etCorreo;
    private EditText etCodigo;
    private EditText etPassword;
    private AuthRepository authRepository;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recuperar_password);
        authRepository = new AuthRepository(this);

        etCorreo = findViewById(R.id.etCorreo);
        etCodigo = findViewById(R.id.etCodigo);
        etPassword = findViewById(R.id.etPassword);

        findViewById(R.id.btnEnviarCodigo).setOnClickListener(v -> enviarCodigo());
        findViewById(R.id.btnCambiarPassword).setOnClickListener(v -> cambiarPassword());
        findViewById(R.id.btnVolver).setOnClickListener(v -> finish());
    }

    private void enviarCodigo() {
        String correo = etCorreo.getText().toString().trim();
        if (!Patterns.EMAIL_ADDRESS.matcher(correo).matches()) {
            etCorreo.setError("Correo no válido");
            return;
        }
        String code = authRepository.beginPasswordRecovery(correo);
        if (code == null) {
            Toast.makeText(this, "Si el correo existe, recibirás un código",
                    Toast.LENGTH_LONG).show();
            return;
        }
        // Sustituir por envío de correo al integrar la API.
        Toast.makeText(this, "Código temporal: " + code, Toast.LENGTH_LONG).show();
    }

    private void cambiarPassword() {
        String code = etCodigo.getText().toString().trim();
        String password = etPassword.getText().toString();
        if (!password.matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,64}$")) {
            etPassword.setError("Usa 8-64 caracteres, mayúscula, minúscula y número");
            return;
        }
        if (authRepository.resetPassword(code, password) == AuthRepository.RecoveryResult.INVALID_CODE) {
            etCodigo.setError("Código incorrecto o vencido");
            return;
        }
        Toast.makeText(this, "Contraseña actualizada", Toast.LENGTH_LONG).show();
        finish();
    }
}
