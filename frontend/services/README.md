# Microservices Overview

This directory contains the initial decomposition of the monolith into independent Flask services. Each service can run on its own port and reuses helpers from `services/common` so configuration stays consistent.

## Services

- `auth_service`: Authentication endpoints (login) that work with `db_connection.authenticate_user`.
- `doctor_service`: Doctor-focused routes for the dashboard (patients listing, search, assignments).
- `patient_service`: Patient data APIs (catalogs, profile updates, consultations).
- `ai_service`: Gemini + D-ID integration surface. Currently exposes health information while the avatar endpoints are migrated from the monolith.

## Shared Layer

Common functionality lives under `services/common`:

- `config.py`: `ServiceConfig` helper for consistent host/port debug flags.
- `cors.py`: CORS defaults that mirror the monolith settings.
- `utils.py`: XML parsing/creation helpers to reuse from future services.
- `ai.py`: Gemini and D-ID wrappers plus summarization helper.

## Running Locally

Each service exposes a runnable `app.py`. Puedes iniciarlos manualmente:

```powershell
# Auth
python services/auth_service/app.py 8010

# Doctor
python services/doctor_service/app.py 8011

# Patient
python services/patient_service/app.py 8012

# AI
python services/ai_service/app.py 8013
```

If you omit the port argument, a default port from `ServiceConfig` is used. Make sure your `.env` file is present so database and external API credentials load correctly.

Para levantarlos todos en paralelo, usa el script `services/start_services.ps1`:

```powershell
cd frontend/services
./start_services.ps1
./start_services.ps1 -VenvPath C:\ruta\a\tu_venv
./start_services.ps1 -Foreground
```

## Next Steps

1. Gradually move remaining routes from `server_combined.py` into their respective services.
2. Wire a reverse proxy (Flask `DispatcherMiddleware`, API Gateway, or frontend `.env` base URLs) so the React app calls the correct service.
3. Containerize each service (Dockerfile + docker-compose) once routes are stabilized.
4. Replace the legacy hard-coded D-ID credentials with the `DID_BASIC_TOKEN` env variable referenced in `services/common/ai.py`.
