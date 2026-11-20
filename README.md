# Rampify

Plataforma para documentar barreras de accesibilidad urbana en la
Ciudad de México y dar seguimiento a su atención.

## Estructura
- Rampify_web/backend     -> API Node.js + Express
- Rampify_web/frontend    -> sitio web (HTML, CSS, JS)
- Rampify_movil/RampifyV1 -> app Android (Java)

## Equipo
- Juan:   frontend web y rutas de gestión
- Martin: app móvil
- Carlos: backend base, API móvil, configuración y documentación

## Backend en local
    cd Rampify_web/backend
    cp .env.example .env      (llenar con los valores reales)
    npm install
    npm run dev               (http://localhost:3000)

## App móvil
Abrir Rampify_movil/RampifyV1 con Android Studio. La URL del backend
está en app/build.gradle.kts (API_BASE_URL).

## Variables de entorno
Ver .env.example. El archivo .env real NUNCA se sube a Git.
Despliegue: ver docs/despliegue.md
