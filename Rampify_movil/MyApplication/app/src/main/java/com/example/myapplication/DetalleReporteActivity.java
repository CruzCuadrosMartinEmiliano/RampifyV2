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

import org.json.JSONObject;

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
            Toast.makeText(this, R.string.report_load_failed, Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        mostrarDatos();
        if (reporte.isOwnReport()) cargarDetalleServidor();
        if (!reporte.isOwnReport()) btnSolicitarEliminacion.setVisibility(View.GONE);

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
        tvFolio.setText(getString(R.string.folio_label, reporte.getFolio()));
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

    private void cargarDetalleServidor() {
        if (reporte.getServerId() <= 0) return;
        new ApiClient(this).reportDetail(reporte.getServerId(), (ok, status, data) ->
                runOnUiThread(() -> {
                    if (!ok) return;
                    JSONObject detalle = data.optJSONObject("reporte");
                    if (detalle == null) return;
                    reporte = new Reporte(
                            reporte.getServerId(),
                            detalle.optString("folio", reporte.getFolio()),
                            detalle.optString("tipo", reporte.getTipo()),
                            detalle.optString("descripcion", reporte.getDescripcion()),
                            detalle.optString("estado", reporte.getEstado()),
                            detalle.optString("direccion", getString(R.string.report_location)),
                            detalle.optString("fecha", reporte.getFecha()),
                            getString(R.string.mexico_city),
                            detalle.optDouble("latitud", reporte.getLat()),
                            detalle.optDouble("longitud", reporte.getLng()),
                            reporte.getFotoUri());
                    mostrarDatos();
                }));
    }
}