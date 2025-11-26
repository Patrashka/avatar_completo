# Microservicio JWT-Redis

Microservicio para gestión de tokens JWT utilizando Redis como almacenamiento.

## Archivos Principales

- `app.py` - Aplicación Flask con endpoints REST
- `jwt_service.py` - Lógica de gestión de tokens JWT
- `redis_service.py` - Integración con Redis
- `requirements.txt` - Dependencias Python
- `env.example` - Plantilla de configuración

## Configuración

1. Copiar `env.example` a `.env`
2. Configurar variables de entorno (Redis y JWT)
3. Instalar dependencias: `pip install -r requirements.txt`
4. Ejecutar: `python app.py`

## Endpoints

- `POST /api/auth/login` - Genera tokens JWT
- `POST /api/auth/validate` - Valida token
- `POST /api/auth/refresh` - Refresca access token
- `POST /api/auth/logout` - Revoca token
- `GET /api/auth/user-info` - Obtiene info del usuario
- `GET /health` - Health check

## Variables de Entorno

Ver `env.example` para la lista completa de variables requeridas.
