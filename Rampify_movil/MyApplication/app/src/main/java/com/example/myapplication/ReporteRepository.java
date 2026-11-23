package com.example.rampifyv1;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class ReporteRepository {
    private final RampifyDatabase database;

    public ReporteRepository(Context context) {
        database = new RampifyDatabase(context);
    }

    public List<Reporte> obtenerTodos() {
        List<Reporte> reportes = new ArrayList<>();
        try (Cursor cursor = database.getReadableDatabase().query(
                "report_cache", null, null, null, null, null, "id DESC")) {
            while (cursor.moveToNext()) {
                reportes.add(new Reporte(
                        cursor.getInt(cursor.getColumnIndexOrThrow("server_id")),
                        cursor.getString(cursor.getColumnIndexOrThrow("folio")),
                        cursor.getString(cursor.getColumnIndexOrThrow("tipo")),
                        cursor.getString(cursor.getColumnIndexOrThrow("descripcion")),
                        cursor.getString(cursor.getColumnIndexOrThrow("estado")),
                        cursor.getString(cursor.getColumnIndexOrThrow("direccion")),
                        cursor.getString(cursor.getColumnIndexOrThrow("fecha")),
                        cursor.getString(cursor.getColumnIndexOrThrow("zona")),
                        cursor.getDouble(cursor.getColumnIndexOrThrow("latitud")),
                        cursor.getDouble(cursor.getColumnIndexOrThrow("longitud")),
                        cursor.getString(cursor.getColumnIndexOrThrow("foto_uri"))));
            }
        }
        return reportes;
    }

    public void sincronizar(JSONArray items) {
        SQLiteDatabase writable = database.getWritableDatabase();
        writable.beginTransaction();
        try {
            java.util.HashMap<String, String> fotos = new java.util.HashMap<>();
            java.util.HashMap<String, String> descripciones = new java.util.HashMap<>();
            java.util.HashMap<String, Double> latitudes = new java.util.HashMap<>();
            java.util.HashMap<String, Double> longitudes = new java.util.HashMap<>();
            try (Cursor cursor = writable.query("report_cache",
                    new String[]{"folio", "foto_uri", "descripcion", "latitud", "longitud"},
                    null, null, null, null, null)) {
                while (cursor.moveToNext()) {
                    String folio = cursor.getString(0);
                    String uri = cursor.getString(1);
                    if (uri != null) fotos.put(folio, uri);
                    descripciones.put(folio, cursor.getString(2));
                    latitudes.put(folio, cursor.getDouble(3));
                    longitudes.put(folio, cursor.getDouble(4));
                }
            }
            writable.delete("report_cache", null, null);
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                ContentValues values = new ContentValues();
                String folio = item.optString("folio");
                values.put("server_id", item.optInt("id"));
                values.put("folio", folio);
                values.put("tipo", item.optString("tipo", "Reporte"));
                values.put("estado", item.optString("estado", Reporte.PENDIENTE));
                values.put("descripcion", descripciones.containsKey(folio)
                        ? descripciones.get(folio) : "");
                values.put("direccion", "Ubicacion reportada");
                values.put("zona", "Ciudad de Mexico");
                values.put("latitud", latitudes.containsKey(folio) ? latitudes.get(folio) : 0.0);
                values.put("longitud", longitudes.containsKey(folio) ? longitudes.get(folio) : 0.0);
                values.put("fecha", item.optString("fecha", ""));
                values.put("foto_uri", fotos.get(folio));
                writable.insert("report_cache", null, values);
            }
            writable.setTransactionSuccessful();
        } finally {
            writable.endTransaction();
        }
    }

    public Reporte guardar(String tipo, String descripcion, String fotoUri, double lat, double lng) {
        String folio = "RMP-LOCAL-" + new SimpleDateFormat("yyyyMMddHHmmssSSS", Locale.US).format(new Date());
        return guardar(folio, 0, tipo, descripcion, fotoUri, lat, lng);
    }

    public Reporte guardarServidor(int serverId, String folio, String tipo, String descripcion,
                                   String fotoUri, double lat, double lng) {
        return guardar(folio, serverId, tipo, descripcion, fotoUri, lat, lng);
    }

    private Reporte guardar(String folio, int serverId, String tipo, String descripcion,
                            String fotoUri, double lat, double lng) {
        String fecha = new SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.US).format(new Date());
        Reporte reporte = new Reporte(serverId, folio, tipo, descripcion, Reporte.PENDIENTE,
                "Ubicación reportada", fecha, "Ciudad de México", lat, lng, fotoUri);
        ContentValues values = new ContentValues();
        values.put("server_id", serverId);
        values.put("folio", reporte.getFolio());
        values.put("tipo", reporte.getTipo());
        values.put("estado", reporte.getEstado());
        values.put("descripcion", reporte.getDescripcion());
        values.put("direccion", reporte.getDireccion());
        values.put("zona", reporte.getZona());
        values.put("latitud", reporte.getLat());
        values.put("longitud", reporte.getLng());
        values.put("fecha", reporte.getFecha());
        values.put("foto_uri", reporte.getFotoUri());
        database.getWritableDatabase().insertOrThrow("report_cache", null, values);
        return reporte;
    }
}
