package com.example.rampifyv1;

import android.os.Bundle;
import android.net.Uri;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import android.content.Intent;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

public class DetalleReporteActivity extends AppCompatActivity {

    private TextView tvVolver, tvTipo, tvEstado, tvFolio, tvDireccion, tvFecha, tvDescripcion;
    private Button btnSolicitarEliminacion;
    private ImageView ivDetFoto;
    private Reporte reporte;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_detalle_reporte);

        tvVolver = findViewById(R.id.tvVolver);
        tvTipo = findViewById(R.id.tvDetTipo);
        tvEstado = findViewById(R.id.tvDetEstado);
        tvFolio = findViewById(R.id.tvDetFolio);
        tvDireccion = findViewById(R.id.tvDetDireccion);
        tvFecha = findViewById(R.id.tvDetFecha);
        tvDescripcion = findViewById(R.id.tvDetDescripcion);
        btnSolicitarEliminacion = findViewById(R.id.btnSolicitarEliminacion);
        ivDetFoto = findViewById(R.id.ivDetFoto);

        // Recibimos el Reporte (Parcelable) enviado con putExtra
        reporte = getIntent().getParcelableExtra("reporte");

        if (reporte == null) {
            Toast.makeText(this, "No se pudo cargar el reporte", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        mostrarDatos();

        tvVolver.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        btnSolicitarEliminacion.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(DetalleReporteActivity.this, SolicitudEliminacionActivity.class);
                intent.putExtra("reporte", reporte);
                startActivity(intent);
            }
        });
    }

    private void mostrarDatos() {
        tvTipo.setText(reporte.getTipo());
        tvFolio.setText("Folio " + reporte.getFolio());
        tvDireccion.setText(reporte.getDireccion() + " · " + reporte.getZona());
        tvFecha.setText(reporte.getFecha());
        tvDescripcion.setText(reporte.getDescripcion());
        if (reporte.getFotoUri() != null) {
            ivDetFoto.setImageURI(Uri.parse(reporte.getFotoUri()));
        }

        tvEstado.setText(reporte.getEstado());

        int fondo = R.drawable.bg_status_pending;
        int texto = R.color.status_pending_text;
        if (reporte.getEstado().equals(Reporte.EN_PROCESO)) {
            fondo = R.drawable.bg_status_progress;
            texto = R.color.status_progress_text;
        } else if (reporte.getEstado().equals(Reporte.SOLUCIONADO)) {
            fondo = R.drawable.bg_status_solved;
            texto = R.color.status_solved_text;
        }
        tvEstado.setBackgroundResource(fondo);
        tvEstado.setTextColor(ContextCompat.getColor(this, texto));
    }
}