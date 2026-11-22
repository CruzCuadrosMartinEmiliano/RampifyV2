package com.example.rampifyv1;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

public class NuevoReporteActivity extends AppCompatActivity {

    private Spinner spTipo;
    private EditText etDescripcion;
    private FrameLayout areaFoto;
    private LinearLayout placeholderFoto;
    private ImageView ivFoto;
    private Button btnEnviar;
    private TextView tvVolver;
    private TextView tvUbicacion;
    private LocationManager locationManager;
    private Uri fotoUri;
    private double lat = 19.4326;
    private double lng = -99.1332;

    private boolean hayFoto = false;
    private static final int REQUEST_FOTO = 100;
    private static final int REQUEST_UBICACION = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_nuevo_reporte);

        spTipo = findViewById(R.id.spTipo);
        etDescripcion = findViewById(R.id.etDescripcion);
        areaFoto = findViewById(R.id.areaFoto);
        placeholderFoto = findViewById(R.id.placeholderFoto);
        ivFoto = findViewById(R.id.ivFoto);
        btnEnviar = findViewById(R.id.btnEnviar);
        tvVolver = findViewById(R.id.tvVolver);
        tvUbicacion = findViewById(R.id.tvUbicacion);
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        obtenerUbicacion();

        tvVolver.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        areaFoto.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("image/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(intent, REQUEST_FOTO);
            }
        });

        btnEnviar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (datosValidos()) {
                    mostrarConfirmacion();
                }
            }
        });
    }

    private boolean datosValidos() {
        boolean valido = true;

        if (spTipo.getSelectedItemPosition() == 0) {
            Toast.makeText(this, "Selecciona el tipo de falla", Toast.LENGTH_SHORT).show();
            valido = false;
        }

        String descripcion = etDescripcion.getText().toString().trim();
        if (descripcion.isEmpty()) {
            etDescripcion.setError("Describe brevemente el problema");
            valido = false;
        } else if (descripcion.length() < 10) {
            etDescripcion.setError("Escribe al menos 10 caracteres");
            valido = false;
        }

        if (valido && !hayFoto) {
            Toast.makeText(this, "Añade una fotografía de evidencia", Toast.LENGTH_SHORT).show();
            valido = false;
        }

        return valido;
    }

    private void mostrarConfirmacion() {
        Reporte reporte = new ReporteRepository(this).guardar(
                spTipo.getSelectedItem().toString(),
                etDescripcion.getText().toString().trim(),
                fotoUri.toString(), lat, lng);

        new AlertDialog.Builder(this)
                .setTitle("Reporte enviado")
                .setMessage("Tu folio de seguimiento es:\n\n" + reporte.getFolio()
                        + "\n\nPuedes consultarlo en Historial.")
                .setCancelable(false)
                .setPositiveButton("Aceptar", new android.content.DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(android.content.DialogInterface dialog, int which) {
                        Intent intent = new Intent(NuevoReporteActivity.this, MapaActivity.class);
                        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        startActivity(intent);
                        finish();
                    }
                })
                .show();
    }

    private void obtenerUbicacion() {
        if (androidx.core.content.ContextCompat.checkSelfPermission(this,
                android.Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION},
                    REQUEST_UBICACION);
            return;
        }
        Location location = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        if (location == null) {
            location = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
        }
        actualizarUbicacion(location);
        try {
            locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,
                    5000L, 10f, new LocationListener() {
                        @Override
                        public void onLocationChanged(Location location) {
                            actualizarUbicacion(location);
                            locationManager.removeUpdates(this);
                        }
                    });
        } catch (SecurityException exception) {
            Toast.makeText(this, "No se pudo obtener la ubicación", Toast.LENGTH_SHORT).show();
        }
    }

    private void actualizarUbicacion(Location location) {
        if (location != null) {
            lat = location.getLatitude();
            lng = location.getLongitude();
            tvUbicacion.setText(String.format(java.util.Locale.US,
                    "Ubicación actual (%.5f, %.5f)", lat, lng));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_FOTO && resultCode == RESULT_OK
                && data != null && data.getData() != null) {
            fotoUri = data.getData();
            try {
                getContentResolver().takePersistableUriPermission(fotoUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
                // Algunos proveedores no ofrecen permisos persistentes.
            }
            hayFoto = true;
            ivFoto.setImageURI(fotoUri);
            ivFoto.setVisibility(View.VISIBLE);
            placeholderFoto.setVisibility(View.GONE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQUEST_UBICACION && results.length > 0
                && results[0] == PackageManager.PERMISSION_GRANTED) {
            obtenerUbicacion();
        }
    }
}