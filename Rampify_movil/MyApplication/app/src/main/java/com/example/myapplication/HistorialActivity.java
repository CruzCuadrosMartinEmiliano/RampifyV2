package com.example.rampifyv1;

import android.content.Intent;
import android.location.Location;
import android.location.LocationManager;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ListView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class HistorialActivity extends AppCompatActivity {

    private Spinner spFiltro;
    private Spinner spOrigen;
    private ListView lvReportes;
    private TextView tvVacio;

    private List<Reporte> todos;
    private List<Reporte> visibles;
    private ReporteAdapter adapter;
    private static final int LOCATION_REQUEST = 300;
    private static final double CDMX_LATITUDE = 19.4326;
    private static final double CDMX_LONGITUDE = -99.1332;
    private boolean mostrandoCercanos = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_historial);

        spFiltro = findViewById(R.id.spFiltro);
        spOrigen = findViewById(R.id.spOrigen);
        lvReportes = findViewById(R.id.lvReportes);
        tvVacio = findViewById(R.id.tvVacio);

        MenuInferior.configurar(this, MenuInferior.HISTORIAL);

        todos = new ReporteRepository(this).obtenerTodos();
        visibles = new ArrayList<>(todos);
        adapter = new ReporteAdapter(this, visibles);
        lvReportes.setAdapter(adapter);

        spFiltro.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                filtrar(spFiltro.getSelectedItem().toString());
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) { }
        });

        spOrigen.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                mostrandoCercanos = position == 1;
                if (mostrandoCercanos) cargarCercanos();
                else {
                    recargarDesdeCache();
                    sincronizarHistorial();
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) { }
        });

        lvReportes.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                Reporte r = visibles.get(position);
                Intent intent = new Intent(HistorialActivity.this, DetalleReporteActivity.class);
                intent.putExtra("reporte", r);
                startActivity(intent);
            }
        });

        sincronizarHistorial();
    }

    private void cargarCercanos() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
            cargarCercanosEn(CDMX_LATITUDE, CDMX_LONGITUDE);
            return;
        }
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
        } catch (SecurityException ignored) { }
        cargarCercanosEn(latitude, longitude);
    }

    private void cargarCercanosEn(double latitude, double longitude) {
        new ApiClient(this).nearbyReports(latitude, longitude, (ok, status, data) ->
                runOnUiThread(() -> {
                    if (!ok) {
                        Toast.makeText(this, "No fue posible cargar reportes cercanos",
                                Toast.LENGTH_SHORT).show();
                        return;
                    }
                    JSONArray items = data.optJSONArray("reportes");
                    todos.clear();
                    if (items != null) {
                        for (int i = 0; i < items.length(); i++) {
                            JSONObject item = items.optJSONObject(i);
                            if (item == null) continue;
                            todos.add(Reporte.cercano(
                                    item.optInt("id"),
                                    item.optString("folio"),
                                    item.optString("tipo", "Reporte"),
                                    item.optString("descripcion", ""),
                                    item.optString("estado", Reporte.PENDIENTE),
                                    item.optString("fecha", ""),
                                    item.optDouble("latitud", 0),
                                    item.optDouble("longitud", 0)));
                        }
                    }
                    filtrar(spFiltro.getSelectedItem().toString());
                }));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                           int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_REQUEST) cargarCercanos();
    }

    private void sincronizarHistorial() {
        sincronizarPagina(1, new JSONArray());
    }

    private void sincronizarPagina(int pagina, JSONArray acumulados) {
        new ApiClient(this).reportHistory(pagina, (ok, status, data) -> runOnUiThread(() -> {
            if (!ok) {
                recargarDesdeCache();
                return;
            }
            JSONArray reportes = data.optJSONArray("reportes");
            if (reportes != null) {
                for (int i = 0; i < reportes.length(); i++) {
                    JSONObject reporte = reportes.optJSONObject(i);
                    if (reporte != null) acumulados.put(reporte);
                }
            }
            int paginas = Math.max(data.optInt("paginas", 1), 1);
            if (pagina < paginas) {
                sincronizarPagina(pagina + 1, acumulados);
            } else {
                new ReporteRepository(this).sincronizar(acumulados);
                recargarDesdeCache();
            }
        }));
    }

    private void recargarDesdeCache() {
        todos.clear();
        todos.addAll(new ReporteRepository(this).obtenerTodos());
        filtrar(spFiltro.getSelectedItem().toString());
    }

    private void filtrar(String estado) {
        visibles.clear();
        for (Reporte r : todos) {
            if (estado.equals("Todos") || estado.equals(r.getEstado())) {
                visibles.add(r);
            }
        }
        adapter.notifyDataSetChanged();
        tvVacio.setVisibility(visibles.isEmpty() ? View.VISIBLE : View.GONE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (todos != null) {
            if (mostrandoCercanos) cargarCercanos();
            else {
                recargarDesdeCache();
                sincronizarHistorial();
            }
        }
    }
}