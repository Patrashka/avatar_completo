# 🩺 Sistema Médico con Avatar IA

Sistema médico completo que integra avatares virtuales (D-ID), inteligencia artificial (Google Gemini), gestión de pacientes y médicos, y un sistema de autenticación JWT.

## 🚀 Inicio Rápido

### Requisitos Previos

- **Docker y Docker Compose** (para bases de datos)
- **Python 3.8+** (para backend y servicios)
- **Node.js 18+** (para frontend)
- **API Keys:**
  - D-ID API Key: https://studio.d-id.com/
  - Gemini API Key: https://makersuite.google.com/app/apikey

### Configuración Rápida

1. **Clonar o descargar el proyecto**
   ```powershell
   # Si es un ZIP, extraerlo
   ```

2. **Configurar bases de datos**
   ```powershell
   cd database
   docker-compose up -d
   ```
   Esto iniciará PostgreSQL (puerto 5432) y MongoDB (puerto 27017) con datos iniciales.

3. **Configurar API Keys**
   
   Los archivos `.env` ya están incluidos con valores de ejemplo. Solo necesitas:
   
   - Editar `backend/.env` y agregar tus API keys:
     ```env
     DID_API_KEY=tu_did_api_key_aqui
     GEMINI_API_KEY=tu_gemini_api_key_aqui
     ```
   
   - El `frontend/.env` ya está configurado con las URLs por defecto.

4. **Instalar dependencias**

   **Backend:**
   ```powershell
   cd backend
   pip install -r requirements.txt
   ```

   **Frontend:**
   ```powershell
   cd frontend
   npm install
   ```

5. **Iniciar servicios**

   **Opción 1: Script automatizado**
   ```powershell
   .\start_all_services.ps1
   ```

   **Opción 2: Manual**
   ```powershell
   # Terminal 1: Backend principal
   cd backend
   python server.py

   # Terminal 2: Servicios de frontend
   cd frontend
   .\start_frontend.ps1

   # Terminal 3: Frontend React
   cd frontend
   npm run dev
   ```

6. **Acceder a la aplicación**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080

## 📋 Estructura del Proyecto

```
avatar_completo/
├── backend/              # Backend principal (Flask, puerto 8080)
│   ├── .env             # Configuración (API keys, DB)
│   └── server.py        # Servidor principal
├── frontend/            # Frontend React + servicios Flask
│   ├── .env             # Configuración (URLs de servicios)
│   ├── src/             # Código React/TypeScript
│   └── services/        # Microservicios Flask
│       ├── auth_service/    # Autenticación (8010)
│       ├── doctor_service/   # Servicios de médico (8011)
│       ├── patient_service/ # Servicios de paciente (8012)
│       └── ai_service/      # Servicios de IA (8013)
├── database/            # Configuración de bases de datos
│   ├── docker-compose.yml
│   └── scripts/        # Scripts SQL de inicialización
└── redis_service/       # Servicio JWT/Redis (opcional)
```

## 🔑 Configuración de API Keys

Ver [API_KEYS_SETUP.md](API_KEYS_SETUP.md) para instrucciones detalladas sobre cómo obtener y configurar las API keys.

### Valores por Defecto en .env

Los archivos `.env` ya incluyen valores de ejemplo. Solo necesitas:

1. **Obtener tus API keys** (ver API_KEYS_SETUP.md)
2. **Reemplazar los valores en `backend/.env`**:
   - `DID_API_KEY=tu_api_key_aqui`
   - `GEMINI_API_KEY=tu_api_key_aqui`

## 🗄️ Bases de Datos

### Credenciales por Defecto

**PostgreSQL:**
- Usuario: `admin`
- Contraseña: `admin123`
- Base de datos: `medico_db`
- Puerto: `5432`

**MongoDB:**
- Usuario: `admin`
- Contraseña: `admin123`
- Base de datos: `medico_mongo`
- Puerto: `27017`

### Iniciar Bases de Datos

```powershell
cd database
docker-compose up -d
```

Ver [database/README.md](database/README.md) para más detalles.

## 👥 Usuarios de Prueba

El sistema incluye usuarios de prueba pre-configurados:

**Pacientes:**
- `carlos.ramirez@test.com` / `password123`
- `laura.sanchez@test.com` / `password123`

**Médicos:**
- `cameron.cordara@clinica.mx` / `password123`
- `roberto.mendoza@clinica.mx` / `password123`

## 📚 Documentación

- [API_KEYS_SETUP.md](API_KEYS_SETUP.md) - Configuración de API keys
- [PROYECTO_RESUMEN.md](PROYECTO_RESUMEN.md) - Resumen completo del proyecto
- [database/README.md](database/README.md) - Documentación de bases de datos

## 🐛 Solución de Problemas

### Los datos no se cargan en la base de datos

Ver [database/README.md](database/README.md) sección "Solución de Problemas".

### Error de API key

Ver [API_KEYS_SETUP.md](API_KEYS_SETUP.md) sección "Troubleshooting".

### Error de CORS

Verifica que `ALLOWED_ORIGINS` en `frontend/.env` incluya `http://localhost:5173`.

## 🔧 Desarrollo

### Estructura de Servicios

- **Backend principal** (8080): Proxy D-ID, conversaciones, resúmenes IA
- **Auth Service** (8010): Autenticación y registro
- **Doctor Service** (8011): Gestión de médicos
- **Patient Service** (8012): Gestión de pacientes
- **AI Service** (8013): Servicios de IA

### Scripts Útiles

```powershell
# Crear paciente de prueba con datos faltantes
cd backend
python create_test_patient.py

# Probar API key de Gemini
cd backend
python test_gemini_key.py
```

## 📝 Notas Importantes

1. **Repositorio Privado:** Este repositorio incluye archivos `.env` con valores de ejemplo. Para producción, cambia todas las contraseñas y API keys.

2. **Docker:** Las bases de datos deben estar corriendo antes de iniciar los servicios.

3. **API Keys:** Las API keys de ejemplo pueden no funcionar. Obtén tus propias keys en los enlaces proporcionados.

4. **Puertos:** Asegúrate de que los puertos 5432, 27017, 8080, 8010-8014, y 5173 estén disponibles.

---

**Última actualización:** 2025-01-27

