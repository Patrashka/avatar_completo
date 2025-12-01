# 📋 Resumen Completo del Proyecto - Sistema Médico con Avatar IA

## 🏗️ Arquitectura General

Este es un sistema médico completo que integra:
- **Avatares virtuales** (D-ID) para interacción con pacientes
- **Inteligencia Artificial** (Google Gemini) para análisis médico
- **Gestión de pacientes y médicos** con dashboards especializados
- **Sistema de autenticación JWT** con Redis
- **CMS** para administración del sistema

---

## 🗂️ Estructura del Proyecto

### 1. **Backend Principal** (`backend/`)
- **Puerto:** 8080
- **Tecnología:** Flask (Python)
- **Responsabilidades:**
  - Proxy para API de D-ID (evita CORS)
  - Gestión de conversaciones D-ID en MongoDB
  - Endpoints de IA (Gemini) para pacientes y médicos
  - Análisis de archivos médicos (imágenes, PDFs)
  - Generación de resúmenes de conversaciones

**Endpoints principales:**
- `POST /api/did/conversations` - Guardar conversaciones
- `GET /api/did/conversations` - Listar conversaciones
- `GET /api/did/conversations/<id>/summary` - Resumen con IA
- `POST /api/ai/patient` - Consulta IA para pacientes
- `POST /api/ai/doctor` - Consulta IA para médicos
- `POST /api/ai/file/analyze_json` - Análisis de archivos
- `GET /api/did/<path:endpoint>` - Proxy genérico D-ID

### 2. **Microservicios Flask** (`frontend/services/`)

#### **Auth Service** (Puerto 8010)
- Autenticación de usuarios
- Integración con servicio JWT
- Validación de credenciales contra PostgreSQL

#### **Patient Service** (Puerto 8012)
- CRUD de pacientes
- Consultas, diagnósticos, archivos
- Catálogos del sistema

#### **Doctor Service** (Puerto 8011)
- Gestión de médicos
- Asignación de pacientes
- Búsqueda de pacientes

#### **AI Service** (Puerto 8013)
- Wrapper para Gemini
- Cliente de avatar D-ID
- Health checks

#### **JWT Service** (Puerto 8014)
- Generación y validación de tokens JWT
- Integración con Redis
- Refresh tokens y logout

### 3. **Frontend React** (`frontend/src/`)
- **Puerto:** 5173
- **Tecnología:** React 19 + TypeScript + Vite
- **Estado:** React Query (TanStack Query)
- **Routing:** React Router v7

**Páginas principales:**
- `/login` - Autenticación
- `/patient` - Dashboard de pacientes
- `/doctor` - Dashboard de médicos
- `/admin` - Dashboard de administración

### 4. **CMS** (`cms_main/`)
- **Backend Node.js** (Puerto 5000)
- **Frontend React** (Puerto 3000)
- Sistema de gestión de contenido médico

### 5. **Bases de Datos** (`database/`)

#### **PostgreSQL** (Puerto 5432)
- **Base de datos:** `medico_db`
- **Usuario:** `admin` / **Password:** `admin123`
- **Contiene:**
  - Usuarios, médicos, pacientes
  - Citas y consultas
  - Diagnósticos
  - Archivos e interpretaciones
  - Catálogos (tipos de sangre, ocupaciones, etc.)

**Stored Procedures principales:**
- `get_patient_by_id_sp()`
- `get_patient_consultations_sp()`
- `get_patient_files_sp()`
- `get_patient_diagnoses_sp()`
- `get_doctor_by_id_sp()`
- `get_doctor_patients_sp()`
- `update_patient_sp()`
- `update_consultation_sp()`

#### **MongoDB** (Puerto 27017)
- **Base de datos:** `medico_mongo`
- **Usuario root:** `admin` / **Password:** `admin123`
- **Colecciones:**
  - `did_conversations` - Conversaciones con avatar D-ID
  - `sesion_avatar` - Sesiones de avatar
  - `interaccion_ia` - Interacciones con IA
  - `turno_conversacion` - Turnos de conversación
  - `consulta_doc` - Documentos de consulta

### 6. **Redis Service** (`redis_service/`)
- **Puerto:** 5001
- Gestión de tokens JWT
- Cache de sesiones

---

## 🔑 Variables de Entorno Requeridas

### Backend (`backend/.env`)
```env
# D-ID (OBLIGATORIO para avatar)
DID_API_KEY=tu_api_key_did

# Gemini (OBLIGATORIO para IA)
GEMINI_API_KEY=tu_api_key_gemini

# MongoDB
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=medico_mongo
MONGO_USER=admin
MONGO_PASSWORD=admin123
MONGO_URI=mongodb://admin:admin123@localhost:27017/medico_mongo?authSource=admin
```

### Frontend (`frontend/.env`)
```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=medico_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123

# MongoDB
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=medico_mongo
MONGO_USER=app_user
MONGO_PASSWORD=app_password

# Gemini (compatible con backend)
GEMINI_API_KEY=tu_api_key_gemini

# Servicios
PATIENT_API=http://localhost:8012
AUTH_API=http://localhost:8010
JWT_SERVICE_URL=http://localhost:8014
```

### Redis Service (`redis_service/.env`)
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
JWT_SECRET_KEY=tu_secret_key_jwt
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=86400
```

---

## 🚀 Inicio del Sistema

### Opción 1: Script Automático (Recomendado)
```powershell
.\start_all_services.ps1
```

Este script inicia todos los servicios en orden:
1. Redis Service (5001)
2. Microservicios Flask (8010-8014)
3. Backend principal (8080)
4. Frontend React (5173)
5. CMS Backend (5000)
6. CMS Frontend (3000)

### Opción 2: Manual

1. **Iniciar bases de datos:**
```bash
cd database
docker-compose up -d
```

2. **Iniciar servicios:**
```powershell
# Redis
cd redis_service
python app.py

# Microservicios (en ventanas separadas)
cd frontend
python services/auth_service/app.py 8010
python services/doctor_service/app.py 8011
python services/patient_service/app.py 8012
python services/ai_service/app.py 8013
python services/jwt_service/app.py 8014

# Backend principal
cd backend
python server.py

# Frontend
cd frontend
npm run dev
```

---

## 🔄 Flujos Principales

### 1. **Autenticación**
```
Usuario → Frontend → Auth Service (8010) → PostgreSQL
                    ↓
                 JWT Service (8014) → Redis
                    ↓
              Retorna tokens JWT
```

### 2. **Consulta con Avatar**
```
Paciente → Frontend → Backend (8080) → D-ID API
                              ↓
                         MongoDB (conversaciones)
                              ↓
                         Gemini (análisis)
```

### 3. **Consulta IA**
```
Usuario → Frontend → Backend (8080) → Gemini
                              ↓
                         MongoDB (historial)
                              ↓
                    Respuesta contextualizada
```

### 4. **Gestión de Pacientes**
```
Médico → Frontend → Patient Service (8012) → PostgreSQL
                                    ↓
                            Stored Procedures
```

---

## 🛠️ Tecnologías Utilizadas

### Backend
- **Flask 3.0** - Framework web
- **Python 3.x** - Lenguaje principal
- **Google Gemini 2.0** - Modelo de IA
- **PyMongo 4.6** - Cliente MongoDB
- **psycopg2** - Cliente PostgreSQL

### Frontend
- **React 19** - Framework UI
- **TypeScript** - Tipado estático
- **Vite 7** - Build tool
- **React Router v7** - Routing
- **TanStack Query** - Gestión de estado servidor
- **React Hot Toast** - Notificaciones

### Bases de Datos
- **PostgreSQL 15** - Base de datos relacional
- **MongoDB 7** - Base de datos NoSQL
- **Redis** - Cache y sesiones

### DevOps
- **Docker & Docker Compose** - Contenedores
- **PowerShell** - Scripts de automatización

---

## 📊 Puertos del Sistema

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Frontend | 5173 | React App principal |
| Backend | 8080 | API principal Flask |
| Auth Service | 8010 | Autenticación |
| Doctor Service | 8011 | Gestión de médicos |
| Patient Service | 8012 | Gestión de pacientes |
| AI Service | 8013 | Servicios de IA |
| JWT Service | 8014 | Gestión de tokens |
| Redis Service | 5001 | Redis |
| CMS Backend | 5000 | CMS API |
| CMS Frontend | 3000 | CMS UI |
| PostgreSQL | 5432 | Base de datos SQL |
| MongoDB | 27017 | Base de datos NoSQL |

---

## ✅ Correcciones Aplicadas

### 1. **Logger usado antes de definirse** ✅
- **Archivo:** `frontend/db_connection.py`
- **Problema:** Logger se usaba en línea 36 pero se definía en línea 47
- **Solución:** Logger movido antes de su uso

### 2. **Inconsistencia en variables Gemini** ✅
- **Problema:** Backend usa `GEMINI_API_KEY`, frontend usa `GOOGLE_GEMINI_API_KEY`
- **Solución:** Frontend ahora acepta ambas variables (prioridad a `GEMINI_API_KEY`)

### 3. **Versiones de modelo diferentes** ✅
- **Problema:** Backend usa `gemini-2.0-flash-exp`, frontend usa `gemini-2.5-flash`
- **Solución:** Frontend actualizado para usar `gemini-2.0-flash-exp` (consistente)

### 4. **Dependencia innecesaria** ✅
- **Archivo:** `backend/requirements.txt`
- **Problema:** `openai==1.12.0` ya no se usa (reemplazado por Gemini)
- **Solución:** Dependencia eliminada

---

## 🔍 Verificación del Sistema

### Health Checks
```powershell
# Verificar estado de todos los servicios
.\start_all_services.ps1 -Status

# Verificar conexiones de BD
python database/tests/test_connections.py

# Verificar servicios
python database/tests/test_services_health.py
```

### Endpoints de Health
- `http://localhost:8080/health` - Backend
- `http://localhost:8010/health` - Auth Service
- `http://localhost:8012/health` - Patient Service
- `http://localhost:8013/health` - AI Service
- `http://localhost:8014/health` - JWT Service
- `http://localhost:5001/health` - Redis Service

---

## 📝 Notas Importantes

1. **D-ID API Key:** Debe estar en formato Base64 o email:api_key. El backend detecta automáticamente el formato.

2. **Gemini API Key:** Se usa la misma key en backend y frontend para consistencia.

3. **MongoDB:** El sistema intenta primero con `app_user`, si falla usa `admin` como fallback.

4. **PostgreSQL:** Todos los accesos usan stored procedures con sufijo `_sp` para mantener consistencia.

5. **JWT:** El servicio JWT es opcional. Si no está disponible, el sistema funciona sin tokens (modo compatible).

6. **CORS:** Todos los servicios tienen CORS habilitado para desarrollo local.

---

## 🐛 Troubleshooting

### Error: "MongoDB no disponible"
- Verificar que Docker esté corriendo: `docker ps`
- Verificar logs: `docker-compose logs mongodb`
- Reiniciar: `docker-compose restart mongodb`

### Error: "PostgreSQL no disponible"
- Verificar conexión: `docker exec -it medico_postgres psql -U admin -d medico_db`
- Verificar logs: `docker-compose logs postgres`

### Error: "GEMINI_API_KEY no encontrada"
- Verificar archivo `.env` en `backend/`
- Verificar que la variable no tenga comillas extras
- Reiniciar el backend después de cambiar `.env`

### Error: "D-ID API 401 Unauthorized"
- Verificar que `DID_API_KEY` esté correctamente configurada
- Verificar formato (Base64 o email:api_key)
- Revisar logs del backend para ver el formato detectado

---

## 🔐 Seguridad

- Las API keys nunca deben subirse a Git (están en `.gitignore`)
- Las contraseñas de BD son para desarrollo (cambiar en producción)
- JWT tokens tienen expiración configurable
- Redis puede requerir password en producción

---

## 📚 Documentación Adicional

- `API_KEYS_SETUP.md` - Guía de configuración de API keys
- `database/README.md` - Documentación de bases de datos
- `frontend/services/README.md` - Documentación de microservicios
- `cms_main/README.md` - Documentación del CMS

---

## 🎯 Próximos Pasos Sugeridos

1. **Testing:** Agregar tests unitarios y de integración
2. **Logging:** Implementar logging estructurado (JSON)
3. **Monitoreo:** Agregar métricas y alertas
4. **Documentación API:** Swagger/OpenAPI para endpoints
5. **CI/CD:** Pipeline de despliegue automatizado
6. **Seguridad:** Rate limiting, validación de inputs más estricta
7. **Performance:** Cache de consultas frecuentes
8. **Escalabilidad:** Load balancing para microservicios

---

**Última actualización:** 2025-01-27
**Versión del sistema:** 1.0.0

