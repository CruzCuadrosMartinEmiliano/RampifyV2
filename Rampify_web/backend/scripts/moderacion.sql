-- Cambios de base de datos del módulo Moderación de usuarios (RF_28 a RF_30). Ejecutar una sola vez.

-- RF_28: estado de cuenta Baneada (el código la usa con id 4; ajusta ESTADO.BANEADA en Routers/usuarios.js si en tu BD tiene otro id)
INSERT INTO estado_cuenta (id_estado_cuenta, nombre)
SELECT 4, 'Baneada' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM estado_cuenta WHERE nombre = 'Baneada');

-- RF_30: alertas enviadas por un administrador (fecha y administrador, CA1). La app móvil las lee de aquí; no dependen de RF_20
CREATE TABLE IF NOT EXISTS alerta_usuario (
  id_alerta    INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_usuario   INT NOT NULL,                              -- destinatario (usuario.id_usuario)
  id_admin     INT NOT NULL,                              -- administrador que la envió
  mensaje      VARCHAR(300) NOT NULL,
  fecha_envio  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leida        TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_alerta_usuario (id_usuario, fecha_envio),
  CONSTRAINT fk_alerta_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
  CONSTRAINT fk_alerta_admin   FOREIGN KEY (id_admin)   REFERENCES usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Si usuario.id_usuario es INT UNSIGNED, cambia id_usuario e id_admin a INT UNSIGNED para que las llaves foráneas se creen.

-- RF_29: nombre, correo y contraseña se borran (NULL). Si DESCRIBE usuario muestra alguno como NOT NULL, ejecuta lo que corresponda
-- (conserva el tipo y la longitud que ya tengan; los de abajo son un ejemplo):
-- ALTER TABLE usuario MODIFY nombre VARCHAR(64) NULL;
-- ALTER TABLE usuario MODIFY correo VARCHAR(254) NULL;          -- el índice UNIQUE de correo admite varios NULL
-- ALTER TABLE usuario MODIFY contrasena_hash VARCHAR(255) NULL;
