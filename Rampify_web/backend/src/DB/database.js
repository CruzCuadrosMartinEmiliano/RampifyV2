require('dotenv').config();

const driver = process.env.DB_DRIVER || 'mysql';

if (driver === 'postgres') {
  const { Pool, types } = require('pg');

  // Postgres devuelve COUNT(*) (bigint) y NUMERIC como texto; MySQL los devolvía como número
  types.setTypeParser(20, (v) => Number(v));
  types.setTypeParser(1700, (v) => parseFloat(v));

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_SIZE || 5),
  });
  // Misma zona horaria que usaba MySQL (-06:00): NOW() y los TIMESTAMP quedan en hora de México
  pool.on('connect', (client) => { client.query("SET TIME ZONE 'America/Mexico_City'").catch(() => {}); });
  // Sin este handler, si Supabase cierra una conexión inactiva el proceso se cae
  pool.on('error', (err) => console.error('Pool Postgres:', err.message));

  const idColumns = {
    usuario: 'id_usuario', codigo_verificacion: 'id_codigo', invitacion_admin: 'id_invitacion',
    reporte: 'id_reporte', historial_estado_reporte: 'id_historial', solicitud_eliminacion_reporte: 'id_solicitud',
    decision_registro: 'id_decision', sancion_cuenta: 'id_sancion', alerta_usuario: 'id_alerta',
    bitacora: 'id_bitacora', denuncia_usuario: 'id_denuncia', tipo_problema: 'id_tipo_problema',
  };

  // ---------- Traductor MySQL -> Postgres ----------
  // Separa los argumentos de primer nivel de una función: "a, f(b, c), 'x'" -> ["a", "f(b, c)", "'x'"]
  function splitArgs(s) {
    const out = []; let depth = 0, quote = null, cur = '';
    for (const ch of s) {
      if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
      if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  }

  // Reescribe NOMBRE(args) con paréntesis anidados. Procesa de la última aparición a la primera (los internos primero)
  function rewriteCalls(text, name, handler) {
    const re = new RegExp(`\\b${name}\\s*\\(`, 'gi');
    for (;;) {
      let last = null, m;
      re.lastIndex = 0;
      while ((m = re.exec(text))) last = m;
      if (!last) return text;
      const start = last.index, open = start + last[0].length;
      let depth = 1, i = open, quote = null;
      for (; i < text.length && depth > 0; i += 1) {
        const ch = text[i];
        if (quote) { if (ch === quote) quote = null; continue; }
        if (ch === "'" || ch === '"') quote = ch;
        else if (ch === '(') depth += 1;
        else if (ch === ')') depth -= 1;
      }
      if (depth !== 0) return text;
      const replacement = handler(splitArgs(text.slice(open, i - 1)));
      if (replacement === null) return text;
      text = text.slice(0, start) + replacement + text.slice(i);
    }
  }

  const UNIT = { SECOND: 'second', MINUTE: 'minute', HOUR: 'hour', DAY: 'day' };
  function intervalExpr(arg) {                       // "INTERVAL ? MINUTE" | "INTERVAL 29 DAY"
    const m = /^INTERVAL\s+(\?|\d+)\s+(SECOND|MINUTE|HOUR|DAY)S?$/i.exec(arg || '');
    if (!m) return null;
    const unit = UNIT[m[2].toUpperCase()];
    return m[1] === '?' ? `(?::float8 * INTERVAL '1 ${unit}')` : `INTERVAL '${m[1]} ${unit}'`;
  }
  const dateArith = (sign) => ([base, interval]) => {
    const iv = intervalExpr(interval);
    if (!iv) return null;
    return `(${base === '?' ? '?::timestamp' : base} ${sign} ${iv})`;
  };
  const formatoFecha = (f) => f.replace(/%Y/g, 'YYYY').replace(/%m/g, 'MM').replace(/%d/g, 'DD')
    .replace(/%H/g, 'HH24').replace(/%i/g, 'MI').replace(/%s/g, 'SS');

  function postgresSql(sql, values) {
    let text = sql.replace(/`/g, '');
    text = text.replace(/\bNOT\s+IN\s*\(\s*\?\s*\)/gi, '<> ALL(?)');
    text = text.replace(/\bIN\s*\(\s*\?\s*\)/gi, '= ANY(?)');
    text = text.replace(/\bCURDATE\(\)/gi, 'CURRENT_DATE');
    text = text.replace(/\bLIKE\b/gi, 'ILIKE');      // MySQL ignoraba mayúsculas; Postgres no

    text = rewriteCalls(text, 'DATE_ADD', dateArith('+'));
    text = rewriteCalls(text, 'DATE_SUB', dateArith('-'));
    text = rewriteCalls(text, 'TIMESTAMPDIFF', ([unit, a, b]) =>
      (/^SECOND$/i.test(unit) && a && b ? `EXTRACT(EPOCH FROM ((${b}) - (${a})))::int` : null));
    text = rewriteCalls(text, 'DATE_FORMAT', ([v, f]) => {
      const m = /^'(.*)'$/.exec(f || '');
      return m ? `to_char(${v}, '${formatoFecha(m[1])}')` : null;
    });
    // ROUND(double, n) no existe en Postgres: se convierte a numeric (marcador para no reprocesar)
    text = rewriteCalls(text, 'ROUND', ([x, n]) => (n === undefined ? null : `__pground((${x})::numeric, ${n})`));
    text = text.replace(/__pground\(/g, 'ROUND(');

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
    let result;
    try {
      result = await executor.query(translated.text, translated.values);
    } catch (e) {
      if (e.code === '23505') e.code = 'ER_DUP_ENTRY';   // el código del proyecto detecta duplicados con el código de MySQL
      throw e;
    }
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

  module.exports = { query, getConnection, _translate: postgresSql };
} else {
  const mysql = require('mysql2');
  const pool = mysql.createPool({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, waitForConnections: true, connectionLimit: 10, queueLimit: 0,
  });
  pool.on('connection', (c) => c.query("SET time_zone = '-06:00'"));
  module.exports = pool.promise();
}