package com.example.rampifyv1;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public class RampifyDatabase extends SQLiteOpenHelper {
    private static final String NAME = "rampify_local.db";
    private static final int VERSION = 1;

    public RampifyDatabase(Context context) {
        super(context.getApplicationContext(), NAME, null, VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE session (id INTEGER PRIMARY KEY CHECK (id = 1), token TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL)");
        db.execSQL("CREATE TABLE report_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, folio TEXT NOT NULL, tipo TEXT NOT NULL, estado TEXT NOT NULL, descripcion TEXT NOT NULL, direccion TEXT NOT NULL, zona TEXT NOT NULL, latitud REAL NOT NULL, longitud REAL NOT NULL, fecha TEXT NOT NULL, foto_uri TEXT)");
        db.execSQL("CREATE TABLE notification_preferences (id INTEGER PRIMARY KEY CHECK (id = 1), state_changes INTEGER NOT NULL DEFAULT 1, report_deletions INTEGER NOT NULL DEFAULT 1)");
        db.execSQL("CREATE TABLE delete_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, folio TEXT NOT NULL, motivo TEXT NOT NULL, comentario TEXT, fecha INTEGER NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS session");
        db.execSQL("DROP TABLE IF EXISTS report_cache");
        db.execSQL("DROP TABLE IF EXISTS notification_preferences");
        db.execSQL("DROP TABLE IF EXISTS delete_requests");
        onCreate(db);
    }

    public void saveSession(String token, String email, String name) {
        ContentValues values = new ContentValues();
        values.put("id", 1);
        values.put("token", token);
        values.put("email", email);
        values.put("name", name);
        getWritableDatabase().insertWithOnConflict("session", null, values, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public String getToken() {
        Cursor cursor = getReadableDatabase().query("session", new String[]{"token"}, "id = 1", null, null, null, null);
        try {
            return cursor.moveToFirst() ? cursor.getString(0) : "";
        } finally {
            cursor.close();
        }
    }

    public void clearSession() {
        getWritableDatabase().delete("session", null, null);
    }
}
