package com.example.rampifyv1;

import android.os.Parcel;
import android.os.Parcelable;

public class Reporte implements Parcelable {

    public static final String PENDIENTE = "Pendiente";
    public static final String EN_PROCESO = "En proceso";
    public static final String SOLUCIONADO = "Solucionado";
    public static final String RECHAZADO = "Rechazado";

    private final String folio, tipo, descripcion, estado, direccion, fecha, zona, fotoUri;
    private final double lat, lng;
    private final int serverId;
    private final boolean ownReport;

    public static Reporte cercano(int serverId, String folio, String tipo, String descripcion,
                                  String estado, String fecha, double lat, double lng) {
        return new Reporte(serverId, folio, tipo, descripcion, estado,
                "Ubicación reportada", fecha, "Ciudad de México", lat, lng, null, false);
    }

    public Reporte(int serverId, String folio, String tipo, String descripcion, String estado,
                   String direccion, String fecha, String zona, double lat, double lng,
                   String fotoUri) {
        this(serverId, folio, tipo, descripcion, estado, direccion, fecha, zona,
                lat, lng, fotoUri, true);
    }

    public Reporte(int serverId, String folio, String tipo, String descripcion, String estado,
                   String direccion, String fecha, String zona, double lat, double lng,
                   String fotoUri, boolean ownReport) {
        this.serverId = serverId;
        this.ownReport = ownReport;
        this.folio = folio;
        this.tipo = tipo;
        this.descripcion = descripcion;
        this.estado = estado;
        this.direccion = direccion;
        this.fecha = fecha;
        this.zona = zona;
        this.lat = lat;
        this.lng = lng;
        this.fotoUri = fotoUri;
    }

    public Reporte(String folio, String tipo, String descripcion, String estado,
                   String direccion, String fecha, String zona, double lat, double lng) {
        this(folio, tipo, descripcion, estado, direccion, fecha, zona, lat, lng, null);
    }

    public Reporte(String folio, String tipo, String descripcion, String estado,
                   String direccion, String fecha, String zona, double lat, double lng,
                   String fotoUri) {
        this.serverId = 0;
        this.ownReport = true;
        this.folio = folio;
        this.tipo = tipo;
        this.descripcion = descripcion;
        this.estado = estado;
        this.direccion = direccion;
        this.fecha = fecha;
        this.zona = zona;
        this.lat = lat;
        this.lng = lng;
        this.fotoUri = fotoUri;
    }

    public String getFolio() { return folio; }
    public String getTipo() { return tipo; }
    public String getDescripcion() { return descripcion; }
    public String getEstado() { return estado; }
    public String getDireccion() { return direccion; }
    public String getFecha() { return fecha; }
    public String getZona() { return zona; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public String getFotoUri() { return fotoUri; }
    public int getServerId() { return serverId; }
    public boolean isOwnReport() { return ownReport; }

    // ----- Parcelable -----
    protected Reporte(Parcel in) {
        serverId = in.readInt();
        ownReport = in.readByte() != 0;
        folio = in.readString();
        tipo = in.readString();
        descripcion = in.readString();
        estado = in.readString();
        direccion = in.readString();
        fecha = in.readString();
        zona = in.readString();
        fotoUri = in.readString();
        lat = in.readDouble();
        lng = in.readDouble();
    }

    @Override
    public void writeToParcel(Parcel dest, int flags) {
        dest.writeInt(serverId);
        dest.writeByte((byte) (ownReport ? 1 : 0));
        dest.writeString(folio);
        dest.writeString(tipo);
        dest.writeString(descripcion);
        dest.writeString(estado);
        dest.writeString(direccion);
        dest.writeString(fecha);
        dest.writeString(zona);
        dest.writeString(fotoUri);
        dest.writeDouble(lat);
        dest.writeDouble(lng);
    }

    @Override
    public int describeContents() {
        return 0;
    }

    public static final Creator<Reporte> CREATOR = new Creator<Reporte>() {
        @Override
        public Reporte createFromParcel(Parcel source) {
            return new Reporte(source);
        }

        @Override
        public Reporte[] newArray(int size) {
            return new Reporte[size];
        }
    };
}