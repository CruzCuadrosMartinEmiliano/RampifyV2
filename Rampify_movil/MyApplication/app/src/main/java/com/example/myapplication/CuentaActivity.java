package com.example.rampifyv1;

import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.util.Patterns;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.LinearLayout;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

public class CuentaActivity extends AppCompatActivity {

    private TextView tvVolver, tvCorreoActual, opCambiarCorreo, opCambiarPassword, opCerrarSesion;
    private LinearLayout formCorreo, formPassword;
    private EditText etNuevoCorreo, etPasswordActual, etPasswordNueva;
    private Button btnGuardarCorreo, btnGuardarPassword, btnEliminarCuenta;
    private Button btnCancelarEliminacion;
    private TextView tvEstadoEliminacion;
    private AuthRepository authRepository;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cuenta);

        tvVolver = findViewById(R.id.tvVolver);
        tvCorreoActual = findViewById(R.id.tvCorreoActual);
        opCambiarCorreo = findViewById(R.id.opCambiarCorreo);
        opCambiarPassword = findViewById(R.id.opCambiarPassword);
        opCerrarSesion = findViewById(R.id.opCerrarSesion);
        formCorreo = findViewById(R.id.formCorreo);
        formPassword = findViewById(R.id.formPassword);
        etNuevoCorreo = findViewById(R.id.etNuevoCorreo);
        etPasswordActual = findViewById(R.id.etPasswordActual);
        etPasswordNueva = findViewById(R.id.etPasswordNueva);
        btnGuardarCorreo = findViewById(R.id.btnGuardarCorreo);
        btnGuardarPassword = findViewById(R.id.btnGuardarPassword);
        btnEliminarCuenta = findViewById(R.id.btnEliminarCuenta);
        btnCancelarEliminacion = findViewById(R.id.btnCancelarEliminacion);
        tvEstadoEliminacion = findViewById(R.id.tvEstadoEliminacion);
        authRepository = new AuthRepository(this);
        String correoSesion = new RampifyDatabase(this).getEmail();
        tvCorreoActual.setText("Correo: " + (correoSesion.isEmpty()
                ? authRepository.getEmail() : correoSesion));
        actualizarEstadoEliminacion();

        tvVolver.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        opCambiarCorreo.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                alternar(formCorreo);
                formPassword.setVisibility(View.GONE);
            }
        });

        opCambiarPassword.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                alternar(formPassword);
                formCorreo.setVisibility(View.GONE);
            }
        });

        btnGuardarCorreo.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String correo = etNuevoCorreo.getText().toString().trim();
                if (!Patterns.EMAIL_ADDRESS.matcher(correo).matches()) {
                    etNuevoCorreo.setError("Correo no válido (ej. nombre@correo.com)");
                    return;
                }
                if (!authRepository.updateEmail(correo)) {
                    Toast.makeText(CuentaActivity.this,
                            "No se pudo actualizar el correo", Toast.LENGTH_SHORT).show();
                    return;
                }
                tvCorreoActual.setText("Correo: " + correo);
                etNuevoCorreo.setText("");
                formCorreo.setVisibility(View.GONE);
                Toast.makeText(CuentaActivity.this, "Correo actualizado", Toast.LENGTH_SHORT).show();
            }
        });

        btnGuardarPassword.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String actual = etPasswordActual.getText().toString().trim();
                String nueva = etPasswordNueva.getText().toString().trim();
                if (actual.isEmpty()) {
                    etPasswordActual.setError("Escribe tu contraseña actual");
                    return;
                }
                if (!nueva.matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,64}$")) {
                    etPasswordNueva.setError("Usa 8-64 caracteres, mayúscula, minúscula y número");
                    return;
                }
                if (!authRepository.updatePassword(actual, nueva)) {
                    etPasswordActual.setError("La contraseña actual no es correcta");
                    return;
                }
                etPasswordActual.setText("");
                etPasswordNueva.setText("");
                formPassword.setVisibility(View.GONE);
                Toast.makeText(CuentaActivity.this, "Contraseña actualizada", Toast.LENGTH_SHORT).show();
            }
        });

        opCerrarSesion.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                confirmar("¿Cerrar sesión?", "Volverás a la pantalla de inicio.", "Cerrar sesión",
                        new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                authRepository.logout();
                                new ApiClient(CuentaActivity.this).logout();
                                irABienvenida();
                            }
                        });
            }
        });

        btnEliminarCuenta.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                confirmar("¿Solicitar eliminación de cuenta?",
                        "Tu solicitud será revisada. Tus reportes se conservan como evidencia.",
                        "Solicitar",
                        new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                authRepository.requestAccountDeletion();
                                authRepository.logout();
                                new ApiClient(CuentaActivity.this).logout();
                                Toast.makeText(CuentaActivity.this,
                                        "Solicitud enviada", Toast.LENGTH_LONG).show();
                                irABienvenida();
                            }
                        });
            }
        });

        btnCancelarEliminacion.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                        authRepository.cancelAccountDeletion();
                        actualizarEstadoEliminacion();
                        Toast.makeText(CuentaActivity.this,
                                "Solicitud de eliminación cancelada", Toast.LENGTH_LONG).show();
            }
        });
    }

    private void actualizarEstadoEliminacion() {
        boolean pendiente = authRepository.hasAccountDeletionRequest();
        tvEstadoEliminacion.setVisibility(pendiente ? View.VISIBLE : View.GONE);
        btnCancelarEliminacion.setVisibility(pendiente ? View.VISIBLE : View.GONE);
        btnEliminarCuenta.setVisibility(pendiente ? View.GONE : View.VISIBLE);
    }

    private void alternar(View formulario) {
        formulario.setVisibility(formulario.getVisibility() == View.VISIBLE
                ? View.GONE : View.VISIBLE);
    }

    private void confirmar(String titulo, String mensaje, String textoOk,
                           DialogInterface.OnClickListener accion) {
        new AlertDialog.Builder(this)
                .setTitle(titulo)
                .setMessage(mensaje)
                .setNegativeButton("Cancelar", null)
                .setPositiveButton(textoOk, accion)
                .show();
    }

    private void irABienvenida() {
        Intent intent = new Intent(this, BienvenidaActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }
}