# Microservicio JWT-Redis

Microservicio para gestión de tokens JWT utilizando Redis como almacenamiento.

## Archivos Principales

- `app.py` - Aplicación Flask con endpoints REST
- `jwt_service.py` - Lógica de gestión de tokens JWT
- `redis_service.py` - Integración con Redis
- `requirements.txt` - Dependencias Python

## Configuración

Agregar al archivo `.env` en `frontend/`:

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
REDIS_SSL=False

# JWT
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=604800
```

## Endpoints

- `POST /api/auth/login` - Genera tokens JWT
- `POST /api/auth/validate` - Valida token
- `POST /api/auth/refresh` - Refresca access token
- `POST /api/auth/logout` - Revoca token
- `GET /api/auth/user-info` - Obtiene info del usuario
- `GET /health` - Health check

## Puerto

Por defecto corre en el puerto **8014** (configurable en el script de inicio).

