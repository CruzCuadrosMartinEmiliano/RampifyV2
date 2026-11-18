package com.example.rampifyv1;

import android.content.ContentValues;
import android.content.Context;

public class SolicitudRepository {
    private final RampifyDatabase database;

    public SolicitudRepository(Context context) {
        database = new RampifyDatabase(context);
    }

    public void solicitarEliminacionReporte(Reporte reporte, String motivo, String comentario) {
        ContentValues values = new ContentValues();
        values.put("folio", reporte.getFolio());
        values.put("motivo", motivo);
        values.put("comentario", comentario);
        values.put("fecha", System.currentTimeMillis());
        database.getWritableDatabase().insertOrThrow("delete_requests", null, values);
    }
}
