package com.example.rampifyv1;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ListView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.util.ArrayList;
import java.util.List;

public class HistorialActivity extends AppCompatActivity {

    private Spinner spFiltro;
    private ListView lvReportes;
    private TextView tvVacio;

    private List<Reporte> todos;
    private List<Reporte> visibles;
    private ReporteAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_historial);

        spFiltro = findViewById(R.id.spFiltro);
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

        lvReportes.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                Reporte r = visibles.get(position);
                Intent intent = new Intent(HistorialActivity.this, DetalleReporteActivity.class);
                intent.putExtra("reporte", r);
                startActivity(intent);
            }
        });
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
            todos.clear();
            todos.addAll(new ReporteRepository(this).obtenerTodos());
            filtrar(spFiltro.getSelectedItem().toString());
        }
    }
}