package com.example.rampifyv1;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

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

    public Reporte guardar(String tipo, String descripcion, String fotoUri, double lat, double lng) {
        String folio = "RMP-LOCAL-" + new SimpleDateFormat("yyyyMMddHHmmssSSS", Locale.US).format(new Date());
        String fecha = new SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.US).format(new Date());
        Reporte reporte = new Reporte(folio, tipo, descripcion, Reporte.PENDIENTE,
                "Ubicación actual", fecha, "Ciudad de México", lat, lng, fotoUri);
        ContentValues values = new ContentValues();
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
