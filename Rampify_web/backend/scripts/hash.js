// Uso: npm run hash -- "MiClave123"  → imprime el hash bcrypt para el primer administrador (RampifyBd.sql)
const bcrypt = require('bcryptjs');
const clave = process.argv[2];
if (!clave) { console.log('Uso: npm run hash -- "TuContraseña"'); process.exit(1); }
console.log(bcrypt.hashSync(clave, 10));