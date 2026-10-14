# Despliegue sencillo de la demo

## 1. Configurar nombre y puerto

Editar el archivo `.env` incluido y cambiar únicamente estos valores:

```env
APP_NAME=gemelotur-demo
APP_PORT=3000
API_PORT=3001
```

`APP_PORT` y `API_PORT` son los dos únicos puertos públicos: 3000 (web + API) y 3001 (la misma aplicación, para clientes de API). El contenedor escucha internamente en 3000 y 3001. Cualquier otro servicio (PostGIS, GeoServer) permanece en la red interna de Docker, sin puertos publicados.
`.env.example` queda disponible como copia de referencia.

## 2. Construir y arrancar

```bash
docker compose up -d --build
```

Abrir `http://localhost:3000`, sustituyendo `3000` por el valor configurado en `APP_PORT`.

## Comandos útiles

```bash
# Ver estado y healthcheck
docker compose ps

# Ver registros
docker compose logs -f app

# Detener la demo
docker compose down

# Reconstruir después de recibir cambios
docker compose up -d --build
```

No se requieren base de datos, Cesium ion ni servicios externos de aplicación para esta demostración. Los activos cartográficos procesados y el modelo GLB se incluyen en `public/` durante la construcción de la imagen.
