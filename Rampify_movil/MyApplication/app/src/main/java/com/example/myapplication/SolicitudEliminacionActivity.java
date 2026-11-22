package com.example.rampifyv1;

import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

public class SolicitudEliminacionActivity extends AppCompatActivity {

    private TextView tvVolver, tvFolio;
    private RadioGroup rgMotivo;
    private EditText etComentario;
    private Button btnEnviar, btnCancelar;
    private Reporte reporte;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_solicitud_eliminacion);

        tvVolver = findViewById(R.id.tvVolver);
        tvFolio = findViewById(R.id.tvFolioSolicitud);
        rgMotivo = findViewById(R.id.rgMotivo);
        etComentario = findViewById(R.id.etComentario);
        btnEnviar = findViewById(R.id.btnEnviarSolicitud);
        btnCancelar = findViewById(R.id.btnCancelar);

        reporte = getIntent().getParcelableExtra("reporte");
        if (reporte != null) {
            tvFolio.setText(reporte.getTipo() + " · " + reporte.getFolio());
        }

        View.OnClickListener volver = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        };
        tvVolver.setOnClickListener(volver);
        btnCancelar.setOnClickListener(volver);

        btnEnviar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (rgMotivo.getCheckedRadioButtonId() == -1) {
                    Toast.makeText(SolicitudEliminacionActivity.this,
                            "Selecciona un motivo", Toast.LENGTH_SHORT).show();
                    return;
                }
                // Si elige "Otro", el comentario es obligatorio
                if (rgMotivo.getCheckedRadioButtonId() == R.id.rbOtro
                        && etComentario.getText().toString().trim().isEmpty()) {
                    etComentario.setError("Cuéntanos el motivo");
                    return;
                }
                confirmar();
            }
        });
    }

    private void confirmar() {
        new AlertDialog.Builder(this)
                .setTitle("¿Enviar solicitud?")
                .setMessage("El reporte no se borra de inmediato: la solicitud será revisada.")
                .setNegativeButton("Volver", null)
                .setPositiveButton("Enviar", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        enviar();
                    }
                })
                .show();
    }

    private void enviar() {
        RadioButton elegido = findViewById(rgMotivo.getCheckedRadioButtonId());
        String motivo = elegido.getText().toString();
        String comentario = etComentario.getText().toString().trim();
        if (reporte != null) {
            new SolicitudRepository(this)
                    .solicitarEliminacionReporte(reporte, motivo, comentario);
        }

        Toast.makeText(this, "Solicitud enviada", Toast.LENGTH_LONG).show();

        Intent intent = new Intent(this, HistorialActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        finish();
    }
}