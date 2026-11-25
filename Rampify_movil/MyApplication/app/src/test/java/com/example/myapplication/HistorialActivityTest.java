package com.example.rampifyv1;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class HistorialActivityTest {
    @Test
    public void translatedPendingFilterMatchesSpanishReportState() {
        assertTrue(HistorialActivity.coincideEstadoFiltro(Reporte.PENDIENTE, 1));
        assertFalse(HistorialActivity.coincideEstadoFiltro(Reporte.EN_PROCESO, 1));
    }

    @Test
    public void allReportsFilterIncludesEveryState() {
        assertTrue(HistorialActivity.coincideEstadoFiltro(Reporte.RECHAZADO, 0));
    }
}
