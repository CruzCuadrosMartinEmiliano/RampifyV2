-- Ejecutar una vez en la base de datos de Rampify.
-- Las preferencias se crean con ambos tipos activados por defecto.
CREATE TABLE IF NOT EXISTS preferencia_notificacion (
  id_usuario INT NOT NULL PRIMARY KEY,
  notif_estado_reporte BOOLEAN NOT NULL DEFAULT TRUE,
  notif_eliminacion_reporte BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_preferencia_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);
