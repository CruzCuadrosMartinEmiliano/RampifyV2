package com.example.rampifyv1;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import java.util.List;

public class MapaActivity extends AppCompatActivity {

    // Área de CDMX que representa el placeholder (con API real ya no se usa)
    private static final double LAT_MIN = 19.415, LAT_MAX = 19.450;
    private static final double LNG_MIN = -99.165, LNG_MAX = -99.115;

    private FrameLayout capaPines;
    private LinearLayout cardReporte;
    private TextView tvTipo, tvEstado, tvDireccion, tvFecha;
    private Button btnVerDetalle, btnNuevoReporte;

    private List<Reporte> todos;
    private Reporte seleccionado;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mapa);

        capaPines = findViewById(R.id.capaPines);
        cardReporte = findViewById(R.id.cardReporte);
        tvTipo = findViewById(R.id.tvTipo);
        tvEstado = findViewById(R.id.tvEstado);
        tvDireccion = findViewById(R.id.tvDireccion);
        tvFecha = findViewById(R.id.tvFecha);
        btnVerDetalle = findViewById(R.id.btnVerDetalle);
        btnNuevoReporte = findViewById(R.id.btnNuevoReporte);

        todos = new ReporteRepository(this).obtenerTodos();
        MenuInferior.configurar(this, MenuInferior.MAPA);

        dibujarPines();

        // Tocar el mapa vacío cierra la tarjeta
        capaPines.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                cardReporte.setVisibility(View.GONE);
            }
        });

        btnNuevoReporte.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(MapaActivity.this, NuevoReporteActivity.class));
            }
        });

        btnVerDetalle.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MapaActivity.this, DetalleReporteActivity.class);
                intent.putExtra("reporte", seleccionado);
                startActivity(intent);
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (capaPines != null) {
            todos = new ReporteRepository(this).obtenerTodos();
            dibujarPines();
        }
    }

    // FUTURO: con una API de mapas, este método se reemplaza por addMarker()
    private void dibujarPines() {
        capaPines.post(new Runnable() {
            @Override
            public void run() {
                int ancho = capaPines.getWidth();
                int alto = capaPines.getHeight();
                if (ancho == 0 || alto == 0) {
                    dibujarPines(); // aún no mide, reintenta
                    return;
                }
                capaPines.removeAllViews();
                cardReporte.setVisibility(View.GONE);

                float densidad = getResources().getDisplayMetrics().density;
                int tam = (int) (40 * densidad);


                for (final Reporte r : todos) {

                    ImageView pin = new ImageView(MapaActivity.this);
                    pin.setImageResource(R.drawable.ic_pin);
                    pin.setColorFilter(colorBorde(r.getEstado()));

                    FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(tam, tam);
                    lp.leftMargin = (int) ((r.getLng() - LNG_MIN) / (LNG_MAX - LNG_MIN) * ancho) - tam / 2;
                    lp.topMargin = (int) ((LAT_MAX - r.getLat()) / (LAT_MAX - LAT_MIN) * alto) - tam;
                    pin.setLayoutParams(lp);

                    pin.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            mostrarCard(r);
                        }
                    });
                    capaPines.addView(pin);
                }
            }
        });
    }

    // Se reutiliza igual cuando se toque un marcador de la API
    private void mostrarCard(Reporte r) {
        seleccionado = r;
        tvTipo.setText(r.getTipo());
        tvEstado.setText(r.getEstado());
        tvEstado.setBackgroundResource(fondoEstado(r.getEstado()));
        tvEstado.setTextColor(colorTexto(r.getEstado()));
        tvDireccion.setText(r.getDireccion() + " · " + r.getZona());
        tvFecha.setText(r.getFolio() + " · " + r.getFecha());
        cardReporte.setVisibility(View.VISIBLE);
    }

    private int colorBorde(String estado) {
        int id = R.color.status_pending_border;
        if (estado.equals(Reporte.EN_PROCESO)) id = R.color.status_progress_border;
        if (estado.equals(Reporte.SOLUCIONADO)) id = R.color.status_solved_border;
        return ContextCompat.getColor(this, id);
    }

    private int colorTexto(String estado) {
        int id = R.color.status_pending_text;
        if (estado.equals(Reporte.EN_PROCESO)) id = R.color.status_progress_text;
        if (estado.equals(Reporte.SOLUCIONADO)) id = R.color.status_solved_text;
        return ContextCompat.getColor(this, id);
    }

    private int fondoEstado(String estado) {
        if (estado.equals(Reporte.EN_PROCESO)) return R.drawable.bg_status_progress;
        if (estado.equals(Reporte.SOLUCIONADO)) return R.drawable.bg_status_solved;
        return R.drawable.bg_status_pending;
    }
}