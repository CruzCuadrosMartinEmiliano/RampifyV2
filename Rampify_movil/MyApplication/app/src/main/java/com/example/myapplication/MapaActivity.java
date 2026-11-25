package com.example.rampifyv1;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.location.Location;
import android.location.LocationManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;
import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase;
import org.osmdroid.util.MapTileIndex;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;
import org.osmdroid.views.overlay.Polygon;

import java.util.ArrayList;
import java.util.List;

public class MapaActivity extends AppCompatActivity {
    private static final int LOCATION_REQUEST = 1001;
    private static final float REPORT_CLUSTER_RADIUS_METERS = 30.0f;
    private static final double CDMX_LATITUDE = 19.4326;
    private static final double CDMX_LONGITUDE = -99.1332;
    public static final String EXTRA_REPORT_LATITUDE = "reporte_latitud";
    public static final String EXTRA_REPORT_LONGITUDE = "reporte_longitud";

    private MapView mapa;
    private LinearLayout cardReporte;
    private TextView tvTipo, tvEstado, tvDireccion, tvFecha;
    private Button btnVerDetalle, btnNuevoReporte;

    private List<Reporte> todos;
    private Reporte seleccionado;
    private Marker marcadorUbicacion;
    private double latitude = CDMX_LATITUDE;
    private double longitude = CDMX_LONGITUDE;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mapa);

        Configuration.getInstance().load(this,
                getSharedPreferences("osmdroid", MODE_PRIVATE));
        Configuration.getInstance().setUserAgentValue(
                "RampifyV2/1.0 (Android)");
        Configuration.getInstance().setUserAgentHttpHeader("User-Agent");

        mapa = findViewById(R.id.mapa);
        cardReporte = findViewById(R.id.cardReporte);
        tvTipo = findViewById(R.id.tvTipo);
        tvEstado = findViewById(R.id.tvEstado);
        tvDireccion = findViewById(R.id.tvDireccion);
        tvFecha = findViewById(R.id.tvFecha);
        btnVerDetalle = findViewById(R.id.btnVerDetalle);
        btnNuevoReporte = findViewById(R.id.btnNuevoReporte);

        mapa.setTileSource(new OnlineTileSourceBase(
                "Esri World Street",
                0,
                20,
                256,
                "",
                new String[]{
                        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/"
                },
                "Tiles © Esri © OpenStreetMap contributors") {
            @Override
            public String getTileURLString(long tileIndex) {
                return getBaseUrl()
                        + MapTileIndex.getZoom(tileIndex) + "/"
                        + MapTileIndex.getY(tileIndex) + "/"
                        + MapTileIndex.getX(tileIndex);
            }
        });
        mapa.setMultiTouchControls(true);
        mapa.getController().setZoom(13.0);
        mapa.getController().setCenter(new GeoPoint(latitude, longitude));

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

        if (getIntent().hasExtra(EXTRA_REPORT_LATITUDE)
                && getIntent().hasExtra(EXTRA_REPORT_LONGITUDE)) {
            actualizarUbicacion(getIntent().getDoubleExtra(EXTRA_REPORT_LATITUDE, CDMX_LATITUDE),
                    getIntent().getDoubleExtra(EXTRA_REPORT_LONGITUDE, CDMX_LONGITUDE));
            cargarReportesDesdeServidor(latitude, longitude);
        } else {
            solicitarUbicacionYCargarReportes();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapa != null) mapa.onResume();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent.hasExtra(EXTRA_REPORT_LATITUDE)
                && intent.hasExtra(EXTRA_REPORT_LONGITUDE)) {
            actualizarUbicacion(intent.getDoubleExtra(EXTRA_REPORT_LATITUDE, CDMX_LATITUDE),
                    intent.getDoubleExtra(EXTRA_REPORT_LONGITUDE, CDMX_LONGITUDE));
            cargarReportesDesdeServidor(latitude, longitude);
        }
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
            cargarReportesDesdeServidor(latitude, longitude);
        }
    }

    private void cargarUltimaUbicacion() {
        double currentLatitude = CDMX_LATITUDE;
        double currentLongitude = CDMX_LONGITUDE;
        try {
            LocationManager manager = (LocationManager) getSystemService(LOCATION_SERVICE);
            if (manager != null) {
                for (String provider : manager.getProviders(true)) {
                    Location location = manager.getLastKnownLocation(provider);
                    if (location != null) {
                        currentLatitude = location.getLatitude();
                        currentLongitude = location.getLongitude();
                        break;
                    }
                }
            }
        } catch (SecurityException ignored) {
        }
        actualizarUbicacion(currentLatitude, currentLongitude);
        cargarReportesDesdeServidor(latitude, longitude);
    }

    private void actualizarUbicacion(double latitude, double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
        mapa.getController().setCenter(new GeoPoint(latitude, longitude));
    }

    private void cargarReportesDesdeServidor(double latitude, double longitude) {
        new ApiClient(this).nearbyReports(latitude, longitude, (ok, status, data) ->
                runOnUiThread(() -> {
                    if (!ok) {
                        Toast.makeText(this, status == 0
                                ? getString(R.string.reports_connection_failed)
                                : getString(R.string.reports_load_failed), Toast.LENGTH_SHORT).show();
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
            agregarMarcadorUbicacion();
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
                    getString(R.string.report_location),
                    item.optString("fecha", ""),
                    getString(R.string.mexico_city),
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
        }
        for (List<Reporte> grupo : agruparReportesCercanos()) {
            agregarMarcadorGrupo(grupo);
        }
        agregarMarcadorUbicacion();
        mapa.invalidate();
    }

    private List<List<Reporte>> agruparReportesCercanos() {
        List<List<Reporte>> grupos = new ArrayList<>();
        for (Reporte reporte : todos) {
            List<Reporte> grupoCercano = null;
            for (List<Reporte> grupo : grupos) {
                Reporte referencia = grupo.get(0);
                float[] distancia = new float[1];
                Location.distanceBetween(reporte.getLat(), reporte.getLng(),
                        referencia.getLat(), referencia.getLng(), distancia);
                if (distancia[0] <= REPORT_CLUSTER_RADIUS_METERS) {
                    grupoCercano = grupo;
                    break;
                }
            }
            if (grupoCercano == null) {
                grupoCercano = new ArrayList<>();
                grupos.add(grupoCercano);
            }
            grupoCercano.add(reporte);
        }
        return grupos;
    }

    private void agregarMarcadorGrupo(List<Reporte> grupo) {
        double centerLatitude = 0;
        double centerLongitude = 0;
        for (Reporte reporte : grupo) {
            centerLatitude += reporte.getLat();
            centerLongitude += reporte.getLng();
        }
        GeoPoint centro = new GeoPoint(centerLatitude / grupo.size(),
                centerLongitude / grupo.size());

        Marker marcador = new Marker(mapa);
        marcador.setPosition(centro);
        marcador.setAnchor(Marker.ANCHOR_CENTER,
                grupo.size() == 1 ? Marker.ANCHOR_BOTTOM : Marker.ANCHOR_CENTER);
        if (grupo.size() == 1) {
            Reporte reporte = grupo.get(0);
            marcador.setIcon(ContextCompat.getDrawable(this, R.drawable.ic_pin));
            marcador.setTitle(reporte.getTipo());
            marcador.setSnippet(reporte.getEstado());
        } else {
            marcador.setIcon(crearIconoGrupo(grupo.size()));
            marcador.setTitle(getString(R.string.report_cluster_title, grupo.size()));
            marcador.setSnippet(getString(R.string.tap_to_choose_report));
        }
        marcador.setOnMarkerClickListener((clicked, view) -> {
            if (grupo.size() == 1) {
                mostrarCard(grupo.get(0));
            } else {
                mostrarReportesDelGrupo(grupo);
            }
            mapa.getController().animateTo(centro);
            return true;
        });
        mapa.getOverlays().add(marcador);
    }

    private Drawable crearIconoGrupo(int cantidad) {
        float density = getResources().getDisplayMetrics().density;
        int size = Math.round(44 * density);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(android.graphics.Color.WHITE);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f - density, paint);

        paint.setColor(android.graphics.Color.rgb(109, 40, 217));
        canvas.drawCircle(size / 2f, size / 2f, size / 2f - 3 * density, paint);

        String label = cantidad > 99 ? "99+" : String.valueOf(cantidad);
        paint.setColor(android.graphics.Color.WHITE);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTextSize(16 * getResources().getDisplayMetrics().scaledDensity);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        float baseline = size / 2f - (paint.ascent() + paint.descent()) / 2f;
        canvas.drawText(label, size / 2f, baseline, paint);

        return new BitmapDrawable(getResources(), bitmap);
    }

    private void mostrarReportesDelGrupo(List<Reporte> grupo) {
        String[] opciones = new String[grupo.size()];
        for (int i = 0; i < grupo.size(); i++) {
            Reporte reporte = grupo.get(i);
            opciones[i] = reporte.getTipo() + " · " + reporte.getFolio();
        }
        new AlertDialog.Builder(this)
                .setTitle(getString(R.string.report_cluster_title, grupo.size()))
                .setItems(opciones, (dialog, which) -> mostrarCard(grupo.get(which)))
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void agregarMarcadorUbicacion() {
        marcadorUbicacion = new Marker(mapa);
        marcadorUbicacion.setPosition(new GeoPoint(latitude, longitude));
        marcadorUbicacion.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER);
        marcadorUbicacion.setIcon(ContextCompat.getDrawable(this, R.drawable.ic_my_location));
        marcadorUbicacion.setTitle(getString(R.string.my_location));
        marcadorUbicacion.setSnippet(getString(R.string.nearby_reports));
        mapa.getOverlays().add(marcadorUbicacion);
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