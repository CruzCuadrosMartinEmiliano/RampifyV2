# Despliegue: Render + Supabase

## Base de datos (Supabase)
La base ya está creada. Obtener la URI del Session pooler
(Connect -> Session pooler) y usarla como DATABASE_URL.

## Servidor (Render)
- Tipo: Web Service, rama main
- Root Directory: Rampify_web/backend
- Build: npm install      Start: npm start
- Health check: /health

## Variables de entorno (configurar en Render, no en Git)
DB_DRIVER=postgres
DATABASE_URL=<URI del pooler>
DATABASE_SSL=true
JWT_SECRET=<cadena larga aleatoria>
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USER=<correo>
MAIL_PASS=<contraseña de aplicación>
MAIL_FROM="Rampify <correo>"
NODE_ENV=production
FRONTEND_URL=https://<app>.onrender.com
CORS_ORIGINS=https://<app>.onrender.com
APP_PUBLIC_URL=https://<app>.onrender.com

No definir PORT (lo asigna Render).

## App móvil
Cambiar API_BASE_URL (release) en app/build.gradle.kts por:
https://<app>.onrender.com/api/v1
