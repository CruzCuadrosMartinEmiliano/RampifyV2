package com.example.rampifyv1;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import java.util.List;

public class ReporteAdapter extends ArrayAdapter<Reporte> {

    public ReporteAdapter(Context context, List<Reporte> reportes) {
        super(context, 0, reportes);
    }

    @NonNull
    @Override
    public View getView(int position, @Nullable View convertView, @NonNull ViewGroup parent) {
        if (convertView == null) {
            convertView = LayoutInflater.from(getContext())
                    .inflate(R.layout.item_reporte, parent, false);
        }

        Reporte r = getItem(position);

        TextView tvTipo = convertView.findViewById(R.id.tvItemTipo);
        TextView tvEstado = convertView.findViewById(R.id.tvItemEstado);
        TextView tvDireccion = convertView.findViewById(R.id.tvItemDireccion);
        TextView tvFolio = convertView.findViewById(R.id.tvItemFolio);

        tvTipo.setText(r.getTipo());
        tvEstado.setText(r.getEstado());
        tvDireccion.setText(r.getDireccion() + " · " + r.getZona());
        tvFolio.setText(r.getFolio() + " · " + r.getFecha());

        int fondo = R.drawable.bg_status_pending;
        int texto = R.color.status_pending_text;
        if (r.getEstado().equals(Reporte.EN_PROCESO)) {
            fondo = R.drawable.bg_status_progress;
            texto = R.color.status_progress_text;
        } else if (r.getEstado().equals(Reporte.SOLUCIONADO)) {
            fondo = R.drawable.bg_status_solved;
            texto = R.color.status_solved_text;
        }
        tvEstado.setBackgroundResource(fondo);
        tvEstado.setTextColor(ContextCompat.getColor(getContext(), texto));

        return convertView;
    }
}