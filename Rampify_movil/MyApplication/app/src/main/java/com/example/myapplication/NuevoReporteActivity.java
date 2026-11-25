package com.example.rampifyv1;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
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
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

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
    private int typeId;
    private final List<Integer> typeIds = new ArrayList<>();

    private boolean hayFoto = false;
    private static final int REQUEST_CAMARA = 100;
    private static final int REQUEST_UBICACION = 101;
    private static final int REQUEST_CAMARA_PERMISO = 102;

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
        cargarTiposProblema();

        tvVolver.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        areaFoto.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                abrirCamara();
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
        if (typeId <= 0) {
            Toast.makeText(this, "No se pudo cargar el tipo de falla", Toast.LENGTH_LONG).show();
            cargarTiposProblema();
            return;
        }
        btnEnviar.setEnabled(false);
        String base64Image = convertirFotoBase64();
        if (base64Image.isEmpty()) {
            btnEnviar.setEnabled(true);
            Toast.makeText(this, "No se pudo procesar la fotografía", Toast.LENGTH_LONG).show();
            return;
        }

        new ApiClient(this).createReport(typeId, etDescripcion.getText().toString().trim(),
                lat, lng, base64Image, (ok, status, data) -> runOnUiThread(() -> {
                    btnEnviar.setEnabled(true);
                    if (!ok) {
                        Toast.makeText(this, status == 0
                                ? "No fue posible conectar con el servidor"
                                : "No se pudo enviar el reporte", Toast.LENGTH_LONG).show();
                        return;
                    }
                    int serverId = data.optInt("id", 0);
                    String folio = data.optString("folio", "");
                    Reporte reporte = new ReporteRepository(this).guardarServidor(
                            serverId,
                            folio,
                            spTipo.getSelectedItem().toString(),
                            etDescripcion.getText().toString().trim(),
                            fotoUri.toString(), lat, lng);
                    new AlertDialog.Builder(this)
                            .setTitle("Reporte enviado")
                            .setMessage("Tu folio de seguimiento es:\n\n" + folio)
                            .setCancelable(false)
                            .setPositiveButton("Aceptar", (dialog, which) -> {
                                Intent intent = new Intent(this, MapaActivity.class);
                                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                                startActivity(intent);
                                finish();
                            })
                            .show();
                }));
    }

    private void cargarTiposProblema() {
        new ApiClient(this).problemTypes((ok, status, data) -> runOnUiThread(() -> {
            if (!ok) return;
            JSONArray elementos = data.optJSONArray("elementos");
            if (elementos == null) return;
            typeIds.clear();
            ArrayList<String> nombres = new ArrayList<>();
            nombres.add("Selecciona el tipo de falla");
            typeIds.add(0);
            for (int i = 0; i < elementos.length(); i++) {
                JSONObject elemento = elementos.optJSONObject(i);
                if (elemento == null) continue;
                typeIds.add(elemento.optInt("id"));
                nombres.add(elemento.optString("nombre"));
            }
            spTipo.setAdapter(new android.widget.ArrayAdapter<>(this,
                    android.R.layout.simple_spinner_item, nombres));
            spTipo.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
                @Override
                public void onItemSelected(android.widget.AdapterView<?> parent,
                                           android.view.View view, int position, long id) {
                    typeId = position >= 0 && position < typeIds.size()
                            ? typeIds.get(position) : 0;
                }

                @Override
                public void onNothingSelected(android.widget.AdapterView<?> parent) {
                    typeId = 0;
                }
            });
        }));
    }

    private void abrirCamara() {
        if (androidx.core.content.ContextCompat.checkSelfPermission(this,
                android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.CAMERA},
                    REQUEST_CAMARA_PERMISO);
            return;
        }
        try {
            File imagesDirectory = new File(getCacheDir(), "images");
            if (!imagesDirectory.exists() && !imagesDirectory.mkdirs()) {
                throw new java.io.IOException("No se pudo crear el directorio de fotos");
            }
            String name = "rampify_" + new SimpleDateFormat("yyyyMMdd_HHmmss",
                    Locale.US).format(new Date()) + ".jpg";
            File photoFile = new File(imagesDirectory, name);
            fotoUri = FileProvider.getUriForFile(this,
                    getPackageName() + ".fileprovider", photoFile);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, fotoUri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(intent, REQUEST_CAMARA);
        } catch (Exception exception) {
            Toast.makeText(this, "No se pudo abrir la cámara", Toast.LENGTH_LONG).show();
        }
    }

    private String convertirFotoBase64() {
        try (InputStream input = getContentResolver().openInputStream(fotoUri)) {
            Bitmap original = BitmapFactory.decodeStream(input);
            if (original == null) return "";
            int width = original.getWidth();
            int height = original.getHeight();
            float scale = Math.min(1f, 1600f / Math.max(width, height));
            Bitmap resized = scale < 1f
                    ? Bitmap.createScaledBitmap(original,
                    Math.max(1, Math.round(width * scale)),
                    Math.max(1, Math.round(height * scale)), true)
                    : original;
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            resized.compress(Bitmap.CompressFormat.JPEG, 85, output);
            if (resized != original) resized.recycle();
            original.recycle();
            return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        } catch (Exception exception) {
            return "";
        }
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
        if (requestCode == REQUEST_CAMARA && resultCode == RESULT_OK && fotoUri != null) {
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
        if (requestCode == REQUEST_CAMARA_PERMISO && results.length > 0
                && results[0] == PackageManager.PERMISSION_GRANTED) {
            abrirCamara();
        }
    }
}