require('dotenv').config();

const driver = process.env.DB_DRIVER || 'mysql';

if (driver === 'postgres') {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_SIZE || 10),
  });

  const idColumns = {
    usuario: 'id_usuario', codigo_verificacion: 'id_codigo', invitacion_admin: 'id_invitacion',
    reporte: 'id_reporte', historial_estado_reporte: 'id_historial', solicitud_eliminacion_reporte: 'id_solicitud',
    decision_registro: 'id_decision', sancion_cuenta: 'id_sancion', alerta_usuario: 'id_alerta',
    bitacora: 'id_bitacora', denuncia_usuario: 'id_denuncia', tipo_problema: 'id_tipo_problema',
  };

  function postgresSql(sql, values) {
    let text = sql.replace(/`/g, '');
    text = text.replace(/\bIN\s*\(\s*\?\s*\)/gi, '= ANY(?)');
    text = text.replace(/DATE_FORMAT\(([^,]+),\s*'([^']+)'\)/gi, (_, value, format) => {
      const postgresFormat = format.replace(/%Y/g, 'YYYY').replace(/%m/g, 'MM')
        .replace(/%d/g, 'DD').replace(/%H/g, 'HH24').replace(/%i/g, 'MI');
      return `to_char(${value}, '${postgresFormat}')`;
    });
    text = text.replace(/TIMESTAMPDIFF\(SECOND,\s*NOW\(\),\s*([^)]+)\)/gi, (_, value) => `EXTRACT(EPOCH FROM ((${value}) - NOW()))::int`);
    text = text.replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+(\?)\s+(MINUTE|HOUR|DAY)\)/gi, '($1 + ($2 * INTERVAL \'1 $3\'))');
    text = text.replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+(\d+)\s+(MINUTE|HOUR|DAY)\)/gi, '($1 + INTERVAL \'$2 $3\')');
    text = text.replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s+(\?)\s+(MINUTE|HOUR|DAY)\)/gi, '($1 - ($2 * INTERVAL \'1 $3\'))');
    text = text.replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s+(\d+)\s+(MINUTE|HOUR|DAY)\)/gi, '($1 - INTERVAL \'$2 $3\')');
    text = text.replace(/CURDATE\(\)/gi, 'CURRENT_DATE');
    text = text.replace(/ON DUPLICATE KEY UPDATE\s+notif_estado_reporte\s*=\s*VALUES\(notif_estado_reporte\),\s*notif_eliminacion_reporte\s*=\s*VALUES\(notif_eliminacion_reporte\)/i,
      'ON CONFLICT (id_usuario) DO UPDATE SET notif_estado_reporte = EXCLUDED.notif_estado_reporte, notif_eliminacion_reporte = EXCLUDED.notif_eliminacion_reporte');

    let index = 0;
    text = text.replace(/\?/g, () => `$${++index}`);
    const insert = text.match(/^\s*INSERT\s+INTO\s+([a-z_]+)/i);
    if (insert && !/\bRETURNING\b/i.test(text) && idColumns[insert[1].toLowerCase()]) {
      text += ` RETURNING ${idColumns[insert[1].toLowerCase()]}`;
    }
    return { text, values };
  }

  function readQuery(sql) {
    return /^\s*(SELECT|WITH|SHOW|EXPLAIN)\b/i.test(sql);
  }

  async function execute(executor, sql, values = []) {
    const translated = postgresSql(sql, values);
    const result = await executor.query(translated.text, translated.values);
    if (readQuery(sql)) return [result.rows, result.fields];
    const meta = { affectedRows: result.rowCount, insertId: result.rows[0] && Object.values(result.rows[0])[0] };
    return [meta, result.fields];
  }

  const query = (sql, values) => execute(pool, sql, values);

  async function getConnection() {
    const client = await pool.connect();
    return {
      query: (sql, values) => execute(client, sql, values),
      beginTransaction: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: () => client.release(),
    };
  }

  module.exports = { query, getConnection };
} else {
  const mysql = require('mysql2');
  const pool = mysql.createPool({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, waitForConnections: true, connectionLimit: 10, queueLimit: 0,
  });
  pool.on('connection', (c) => c.query("SET time_zone = '-06:00'"));
  module.exports = pool.promise();
}