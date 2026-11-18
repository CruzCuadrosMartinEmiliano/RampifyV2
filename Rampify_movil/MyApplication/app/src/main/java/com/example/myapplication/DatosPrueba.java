package com.example.rampifyv1;

import java.util.ArrayList;
import java.util.List;

public class DatosPrueba {

    public static List<Reporte> reportes() {
        List<Reporte> lista = new ArrayList<>();
        lista.add(new Reporte("REP-2480", "Rampa destruida", "Rampa rota frente al número 12",
                Reporte.PENDIENTE, "Av. Juárez 45", "24 may 2026", "Cuauhtémoc", 19.4350, -99.1420));
        lista.add(new Reporte("REP-2479", "Banqueta bloqueada", "Puesto ambulante bloquea el paso",
                Reporte.EN_PROCESO, "Calle 5 de Mayo 10", "23 may 2026", "Cuauhtémoc", 19.4320, -99.1330));
        lista.add(new Reporte("REP-2478", "Semáforo sin audio", "No emite sonido al cruzar",
                Reporte.SOLUCIONADO, "Paseo de la Reforma 200", "23 may 2026", "Cuauhtémoc", 19.4285, -99.1560));
        lista.add(new Reporte("REP-2477", "Rampa obstruida", "Auto estacionado sobre la rampa",
                Reporte.PENDIENTE, "Av. Parque Lira 50", "22 may 2026", "Miguel Hidalgo", 19.4430, -99.1250));
        lista.add(new Reporte("REP-2476", "Banqueta en mal estado", "Raíces levantaron el piso",
                Reporte.EN_PROCESO, "Calzada de Tlalpan 300", "21 may 2026", "Benito Juárez", 19.4200, -99.1340));
        lista.add(new Reporte("REP-2475", "Cruce peatonal borrado", "Sin pintura en el cruce",
                Reporte.SOLUCIONADO, "Av. Insurgentes Sur 800", "20 may 2026", "Benito Juárez", 19.4180, -99.1450));
        return lista;
    }
}