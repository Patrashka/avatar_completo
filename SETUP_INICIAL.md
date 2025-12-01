# 🚀 Guía de Setup Inicial

Esta guía te ayudará a configurar el proyecto desde cero para que funcione correctamente.

## ✅ Cambios Realizados para Facilitar el Setup

### Archivos .env Incluidos

Los archivos `.env` ahora están incluidos en el repositorio con valores de ejemplo para que el proyecto funcione inmediatamente después de descargarlo.

**Archivos incluidos:**
- `backend/.env` - Configuración del backend (API keys, base de datos)
- `frontend/.env` - Configuración del frontend (URLs de servicios)

### .gitignore Actualizado

Se han comentado las reglas que ignoraban archivos `.env` para que puedan ser incluidos en el repositorio privado.

## 📋 Pasos para Configurar el Proyecto

### 1. Descargar/Clonar el Proyecto

Si descargaste un ZIP, extrae el contenido en una carpeta.

### 2. Configurar API Keys (OBLIGATORIO)

Los archivos `.env` ya tienen valores de ejemplo, pero necesitas tus propias API keys:

**Backend (`backend/.env`):**
```env
# Reemplaza estos valores con tus propias API keys
DID_API_KEY=tu_did_api_key_aqui
GEMINI_API_KEY=tu_gemini_api_key_aqui
```

**Cómo obtener las API keys:**
- **D-ID:** https://studio.d-id.com/ → API Keys
- **Gemini:** https://makersuite.google.com/app/apikey

### 3. Iniciar Bases de Datos

```powershell
cd database
docker-compose up -d
```

Esto iniciará:
- PostgreSQL en puerto 5432
- MongoDB en puerto 27017

**Verificar que funcionó:**
```powershell
docker ps
# Deberías ver medico_postgres y medico_mongodb corriendo
```

### 4. Instalar Dependencias

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

### 5. Iniciar Servicios

**Opción 1: Script Automatizado**
```powershell
.\start_all_services.ps1
```

**Opción 2: Manual**

Terminal 1 - Backend:
```powershell
cd backend
python server.py
```

Terminal 2 - Servicios Frontend:
```powershell
cd frontend
.\start_frontend.ps1
```

Terminal 3 - Frontend React:
```powershell
cd frontend
npm run dev
```

### 6. Acceder a la Aplicación

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8080

## 🔍 Verificación

### Verificar que las Bases de Datos Tienen Datos

```powershell
# PostgreSQL
docker exec -it medico_postgres psql -U admin -d medico_db -c "SELECT COUNT(*) FROM ROL;"
# Debería mostrar: 3

docker exec -it medico_postgres psql -U admin -d medico_db -c "SELECT COUNT(*) FROM MEDICO;"
# Debería mostrar al menos 2

# MongoDB
docker exec -it medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.adminCommand('ping')"
# Debería mostrar: { ok: 1 }
```

### Verificar que el Backend Funciona

Al iniciar `backend/server.py`, deberías ver:
```
✅ Cliente Gemini inicializado correctamente (modelo: gemini-2.5-flash)
🔑 DID_API_KEY encontrada: True
```

### Verificar que el Frontend Funciona

Al iniciar `npm run dev`, deberías ver:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

## 🐛 Problemas Comunes

### "Los datos no se cargan en la base de datos"

**Solución:**
```powershell
cd database
docker-compose down -v  # Elimina volúmenes
docker-compose up -d     # Reinicia con scripts
```

### "Error: API key not valid"

**Solución:**
1. Verifica que tus API keys sean correctas en `backend/.env`
2. Verifica que no tengan espacios o comillas extra
3. Verifica que las APIs estén habilitadas en Google Cloud Console (para Gemini)

### "Error de CORS"

**Solución:**
Verifica que `ALLOWED_ORIGINS` en `frontend/.env` incluya `http://localhost:5173`

### "Puerto ya en uso"

**Solución:**
Detén otros servicios que usen los puertos:
- 5432 (PostgreSQL)
- 27017 (MongoDB)
- 8080 (Backend)
- 8010-8014 (Servicios)
- 5173 (Frontend React)

O cambia los puertos en los archivos `.env` y `docker-compose.yml`.

## 📝 Notas Importantes

1. **API Keys:** Los valores de ejemplo en `.env` pueden no funcionar. Debes obtener tus propias API keys.

2. **Contraseñas:** Las contraseñas por defecto (`admin123`) son para desarrollo. Cámbialas en producción.

3. **Docker:** Las bases de datos deben estar corriendo antes de iniciar los servicios.

4. **Primera Ejecución:** La primera vez que ejecutes `docker-compose up`, puede tardar unos minutos mientras descarga las imágenes y ejecuta los scripts de inicialización.

## ✅ Checklist de Setup

- [ ] Proyecto descargado/extraído
- [ ] API keys configuradas en `backend/.env`
- [ ] Docker instalado y corriendo
- [ ] Bases de datos iniciadas (`docker-compose up -d`)
- [ ] Datos verificados en bases de datos
- [ ] Dependencias instaladas (backend y frontend)
- [ ] Servicios iniciados
- [ ] Frontend accesible en http://localhost:5173
- [ ] Puedo iniciar sesión con usuarios de prueba

---

**Última actualización:** 2025-01-27

