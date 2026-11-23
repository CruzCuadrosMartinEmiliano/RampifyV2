package com.example.rampifyv1;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;
import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;
import org.osmdroid.views.overlay.Polygon;

import java.util.ArrayList;
import java.util.List;

public class MapaActivity extends AppCompatActivity {
    private static final int LOCATION_REQUEST = 1001;
    private static final double CDMX_LATITUDE = 19.4326;
    private static final double CDMX_LONGITUDE = -99.1332;

    private MapView mapa;
    private LinearLayout cardReporte;
    private TextView tvTipo, tvEstado, tvDireccion, tvFecha;
    private Button btnVerDetalle, btnNuevoReporte;

    private List<Reporte> todos;
    private Reporte seleccionado;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mapa);

        Configuration.getInstance().load(this,
                getSharedPreferences("osmdroid", MODE_PRIVATE));
        Configuration.getInstance().setUserAgentValue(getPackageName());

        mapa = findViewById(R.id.mapa);
        cardReporte = findViewById(R.id.cardReporte);
        tvTipo = findViewById(R.id.tvTipo);
        tvEstado = findViewById(R.id.tvEstado);
        tvDireccion = findViewById(R.id.tvDireccion);
        tvFecha = findViewById(R.id.tvFecha);
        btnVerDetalle = findViewById(R.id.btnVerDetalle);
        btnNuevoReporte = findViewById(R.id.btnNuevoReporte);

        mapa.setTileSource(TileSourceFactory.MAPNIK);
        mapa.setMultiTouchControls(true);
        mapa.getController().setZoom(13.0);
        mapa.getController().setCenter(new GeoPoint(CDMX_LATITUDE, CDMX_LONGITUDE));

        todos = new ArrayList<>();
        MenuInferior.configurar(this, MenuInferior.MAPA);
        btnNuevoReporte.setOnClickListener(v ->
                startActivity(new Intent(MapaActivity.this, NuevoReporteActivity.class)));
        btnVerDetalle.setOnClickListener(v -> {
            if (seleccionado == null) return;
            Intent intent = new Intent(MapaActivity.this, DetalleReporteActivity.class);
            intent.putExtra("reporte", seleccionado);
            startActivity(intent);
        });

        solicitarUbicacionYCargarReportes();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapa != null) mapa.onResume();
        cargarReportesDesdeServidor(CDMX_LATITUDE, CDMX_LONGITUDE);
    }

    @Override
    protected void onPause() {
        if (mapa != null) mapa.onPause();
        super.onPause();
    }

    private void solicitarUbicacionYCargarReportes() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
            cargarUltimaUbicacion();
            return;
        }
        requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_REQUEST && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            cargarUltimaUbicacion();
        } else {
            cargarReportesDesdeServidor(CDMX_LATITUDE, CDMX_LONGITUDE);
        }
    }

    private void cargarUltimaUbicacion() {
        double latitude = CDMX_LATITUDE;
        double longitude = CDMX_LONGITUDE;
        try {
            LocationManager manager = (LocationManager) getSystemService(LOCATION_SERVICE);
            if (manager != null) {
                for (String provider : manager.getProviders(true)) {
                    Location location = manager.getLastKnownLocation(provider);
                    if (location != null) {
                        latitude = location.getLatitude();
                        longitude = location.getLongitude();
                        break;
                    }
                }
            }
        } catch (SecurityException ignored) {
        }
        mapa.getController().setCenter(new GeoPoint(latitude, longitude));
        cargarReportesDesdeServidor(latitude, longitude);
    }

    private void cargarReportesDesdeServidor(double latitude, double longitude) {
        new ApiClient(this).nearbyReports(latitude, longitude, (ok, status, data) ->
                runOnUiThread(() -> {
                    if (!ok) {
                        Toast.makeText(this, status == 0
                                ? "No fue posible cargar los reportes"
                                : "No se pudieron cargar los reportes", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    dibujarReportes(data.optJSONArray("reportes"));
                }));
    }

    private void dibujarReportes(JSONArray reportes) {
        mapa.getOverlays().clear();
        cardReporte.setVisibility(android.view.View.GONE);
        todos = new ArrayList<>();
        if (reportes == null) {
            mapa.invalidate();
            return;
        }

        for (int i = 0; i < reportes.length(); i++) {
            JSONObject item = reportes.optJSONObject(i);
            if (item == null) continue;
            double lat = item.optDouble("latitud");
            double lng = item.optDouble("longitud");
            if (!Double.isFinite(lat) || !Double.isFinite(lng)) continue;

            String estado = item.optString("estado", Reporte.PENDIENTE);
            Reporte reporte = new Reporte(
                    item.optString("folio"),
                    item.optString("tipo", "Reporte"),
                    item.optString("descripcion", ""),
                    estado,
                    "Ubicación reportada",
                    item.optString("fecha", ""),
                    "Ciudad de México",
                    lat,
                    lng);
            todos.add(reporte);

            GeoPoint punto = new GeoPoint(lat, lng);
            Polygon circulo = new Polygon();
            circulo.setPoints(Polygon.pointsAsCircle(punto, 180.0));
            circulo.setFillColor(colorContorno(estado, true));
            circulo.setStrokeColor(colorContorno(estado, false));
            circulo.setStrokeWidth(4.0f);
            mapa.getOverlays().add(circulo);

            Marker marcador = new Marker(mapa);
            marcador.setPosition(punto);
            marcador.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            marcador.setIcon(ContextCompat.getDrawable(this, R.drawable.ic_pin));
            marcador.setTitle(reporte.getTipo());
            marcador.setSnippet(reporte.getEstado());
            marcador.setOnMarkerClickListener((clicked, view) -> {
                mostrarCard(reporte);
                mapa.getController().animateTo(punto);
                return true;
            });
            mapa.getOverlays().add(marcador);
        }
        mapa.invalidate();
    }

    private int colorContorno(String estado, boolean fill) {
        int alpha = fill ? 75 : 230;
        if (Reporte.EN_PROCESO.equals(estado)) {
            return android.graphics.Color.argb(alpha, 245, 158, 11);
        }
        if (Reporte.SOLUCIONADO.equals(estado)) {
            return android.graphics.Color.argb(alpha, 34, 197, 94);
        }
        return android.graphics.Color.argb(alpha, 239, 68, 68);
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
        cardReporte.setVisibility(android.view.View.VISIBLE);
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