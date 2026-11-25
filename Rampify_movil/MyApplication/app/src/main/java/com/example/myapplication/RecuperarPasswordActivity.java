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
            etCorreo.setError(getString(R.string.invalid_email));
            return;
        }
        String code = authRepository.beginPasswordRecovery(correo);
        if (code == null) {
            Toast.makeText(this, R.string.recovery_code_notice,
                    Toast.LENGTH_LONG).show();
            return;
        }
        // Sustituir por envío de correo al integrar la API.
        Toast.makeText(this, getString(R.string.temporary_code, code), Toast.LENGTH_LONG).show();
    }

    private void cambiarPassword() {
        String code = etCodigo.getText().toString().trim();
        String password = etPassword.getText().toString();
        if (!password.matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,64}$")) {
            etPassword.setError(getString(R.string.password_requirements));
            return;
        }
        if (authRepository.resetPassword(code, password) == AuthRepository.RecoveryResult.INVALID_CODE) {
            etCodigo.setError(getString(R.string.invalid_recovery_code));
            return;
        }
        Toast.makeText(this, R.string.password_updated, Toast.LENGTH_LONG).show();
        finish();
    }
}
