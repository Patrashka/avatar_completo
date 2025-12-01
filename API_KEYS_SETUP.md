# 🔑 Configuración de API Keys y Claves Secretas

Esta guía te ayudará a configurar todas las claves necesarias para que el proyecto funcione correctamente.

## 📋 Claves Requeridas

### 1. **D-ID API Key** (OBLIGATORIO para el avatar)

**¿Qué es?**  
La API key de D-ID te permite usar su servicio de avatares en tiempo real.

**¿Dónde obtenerla?**
1. Ve a https://studio.d-id.com/
2. Inicia sesión o crea una cuenta
3. Ve a la sección de API Keys
4. Crea una nueva API key o copia una existente

**Formato:**  
La API key de D-ID puede venir en dos formatos:

1. **Formato sin codificar:** `email:api_key` (ejemplo: `usuario@ejemplo.com:abc123xyz`)
2. **Formato Base64:** La misma API key pero codificada en Base64 (ejemplo: `dXN1YXJpb0BlamVtcGxvLmNvbTphYmMxMjN4eXo=`)

**¿Dónde configurarla?**
- **Archivo:** `backend/.env` o raíz del proyecto `.env`
- **Variable:** `DID_API_KEY`

**Ejemplos:**
```env
# Opción 1: Formato sin codificar (el backend la codificará automáticamente)
DID_API_KEY=usuario@ejemplo.com:abc123xyz

# Opción 2: Formato Base64 (ya codificada)
DID_API_KEY=dXN1YXJpb0BlamVtcGxvLmNvbTphYmMxMjN4eXo=
```

**Nota importante:** 
- El backend detecta automáticamente el formato y codifica la API key si es necesario
- Si obtienes errores 401 (Unauthorized) o 504 (Timeout), verifica que la API key esté correctamente configurada

**Configurar imagen personalizada del avatar (OPCIONAL):**
- **Variable:** `VITE_DID_AVATAR_IMAGE_URL`
- **Opciones:**
  1. **URL pública:** Usa una URL de una imagen accesible desde internet
  2. **Imagen en D-ID:** Sube tu imagen a https://studio.d-id.com/ y copia la URL
  3. **Dejar vacío:** Usa la imagen predeterminada

---

### 2. **GEMINI API Key** (OBLIGATORIO para funcionalidades de IA)

**¿Qué es?**  
La API key de Google Gemini te permite usar las funcionalidades de IA del sistema (resúmenes, análisis, consultas, etc.).

**¿Dónde obtenerla?**
1. Ve a: https://makersuite.google.com/app/apikey
2. Inicia sesión con tu cuenta de Google
3. Crea una nueva API key o copia una existente

**Formato:**  
- Debe empezar con `AIza` y tener aproximadamente 39 caracteres
- Ejemplo: `AIzaSyAL-P_uJ4mKptUV59PBdtmHbniKgHvQqFc`

**¿Dónde configurarla?**
- **Archivo:** `backend/.env` o raíz del proyecto `.env`
- **Variable:** `GEMINI_API_KEY`

**Ejemplo:**
```env
GEMINI_API_KEY=AIzaSyAL-P_uJ4mKptUV59PBdtmHbniKgHvQqFc
```

**⚠️ IMPORTANTE:**
- ✅ Sin comillas alrededor del valor
- ✅ Sin espacios antes o después del `=`
- ✅ Sin espacios al inicio o final de la API key
- ✅ La API key completa (no truncada)

**❌ INCORRECTO:**
```env
GEMINI_API_KEY = "AIzaSyAL-P_uJ4mKptUV59PBdtmHbniKgHvQqFc"  # ❌ Tiene espacios y comillas
GEMINI_API_KEY="AIzaSyAL-P_uJ4mKptUV59PBdtmHbniKgHvQqFc"    # ❌ Tiene comillas
```

**✅ CORRECTO:**
```env
GEMINI_API_KEY=AIzaSyAL-P_uJ4mKptUV59PBdtmHbniKgHvQqFc      # ✅ CORRECTO
```

**Habilitar la API en Google Cloud:**
1. Ve a: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. Selecciona tu proyecto (o crea uno si no tienes)
3. Haz clic en **"HABILITAR"** o **"ENABLE"**
4. Espera unos segundos a que se habilite

**Verificar permisos de la API Key:**
1. Ve a: https://console.cloud.google.com/apis/credentials
2. Busca tu API key
3. Verifica que tenga habilitado:
   - ✅ **Generative Language API** (Gemini API)
   - ✅ Que no esté restringida a IPs específicas (a menos que sea necesario)

**Modelos de Gemini disponibles (Free Tier):**

El sistema intenta usar los modelos en este orden de prioridad:

1. `gemini-2.5-flash` ⭐ (Más reciente, free tier)
2. `gemini-2.5-flash-lite` (Ligero, free tier)
3. `gemini-1.5-flash` (Anterior, free tier)
4. `gemini-pro` (Base, más compatible)
5. `gemini-1.5-pro` (Pro, puede tener límites)

El primer modelo que funcione será el que se use automáticamente.

**Probar la API Key:**
```powershell
cd backend
python test_gemini_key.py
```

Este script te dirá exactamente qué modelo está disponible y si hay algún problema.

---

## 📁 Estructura de Archivos .env

### Backend (`backend/.env`)

```env
# D-ID API Key (para avatar)
DID_API_KEY=tu_did_api_key_aqui

# Gemini API Key (para funcionalidades de IA)
GEMINI_API_KEY=tu_gemini_api_key_aqui

# Base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medico_db
DB_USER=admin
DB_PASSWORD=admin123

# MongoDB
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=medico_mongo
MONGO_USER=admin
MONGO_PASSWORD=admin123
```

### Frontend (`frontend/.env`)

```env
# URLs de los servicios (ajustar según tu configuración)
VITE_API=http://localhost:8080
VITE_AUTH_API=http://localhost:8010
VITE_DOCTOR_API=http://localhost:8011
VITE_PATIENT_API=http://localhost:8012
VITE_AI_API=http://localhost:8013
VITE_ADMIN_API=http://localhost:8014

# CORS (opcional)
ALLOWED_ORIGINS=http://localhost:5173
```

---

## 🐛 Troubleshooting

### Error: "API key not valid" (Gemini)

**Causas comunes:**
1. La API key no tiene permisos o la API no está habilitada
2. Formato incorrecto en el archivo `.env`
3. La API key está restringida por IP o dominio

**Solución:**
1. Verifica que la API esté habilitada: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. Verifica el formato en `.env`: `GEMINI_API_KEY=valor` (sin comillas, sin espacios)
3. Verifica permisos de la API key: https://console.cloud.google.com/apis/credentials
4. Ejecuta `python backend/test_gemini_key.py` para diagnosticar

### Error: "401 Unauthorized" (D-ID)

**Causas comunes:**
1. API key incorrecta o expirada
2. Formato incorrecto de la API key

**Solución:**
1. Verifica que la API key esté correcta en `backend/.env`
2. Verifica que no tenga espacios o comillas extra
3. Prueba crear una nueva API key en https://studio.d-id.com/

### Error: "Gemini client no está inicializado"

**Solución:**
1. Verifica que la API key es válida
2. Verifica que no tiene comillas extras en el .env
3. Reinicia el servicio después de cambiar el .env
4. Revisa los logs del backend para ver el error exacto

### Error: "Quota exceeded" (Gemini)

**Causa:** Has excedido el límite de la versión gratuita

**Solución:**
- Espera unos minutos
- Verifica tu quota en: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
- Considera actualizar a un plan de pago si necesitas más quota

---

## ✅ Checklist de Configuración

### D-ID
- [ ] API key obtenida de https://studio.d-id.com/
- [ ] API key configurada en `backend/.env` como `DID_API_KEY=...`
- [ ] Formato correcto (sin comillas, sin espacios)
- [ ] Backend reiniciado después de configurar

### Gemini
- [ ] API key obtenida de https://makersuite.google.com/app/apikey
- [ ] API key configurada en `backend/.env` como `GEMINI_API_KEY=...`
- [ ] Formato correcto (sin comillas, sin espacios)
- [ ] Generative Language API habilitada en Google Cloud Console
- [ ] API key tiene permisos para Generative Language API
- [ ] Backend reiniciado después de configurar
- [ ] Script de prueba ejecutado: `python backend/test_gemini_key.py`

### Base de Datos
- [ ] PostgreSQL corriendo (puerto 5432)
- [ ] MongoDB corriendo (puerto 27017)
- [ ] Credenciales configuradas en `backend/.env`
- [ ] Base de datos inicializada con los scripts SQL

---

## 🔍 Verificación

### Verificar Backend

Al iniciar el backend, deberías ver en los logs:

```
📄 Cargando .env desde: C:\...\backend\.env
🔑 Configurando Gemini con API key (longitud: 39 caracteres)
✅ Cliente Gemini inicializado correctamente (modelo: gemini-2.5-flash)
🔑 DID_API_KEY encontrada: True
```

### Verificar Servicios

```powershell
# Verificar servicio de autenticación
curl http://localhost:8010/health

# Verificar servicio de IA
curl http://localhost:8013/health
```

---

## 📝 Notas Importantes

1. **Seguridad:** Nunca subas archivos `.env` al repositorio. Están en `.gitignore`
2. **Reinicio:** Siempre reinicia los servicios después de cambiar archivos `.env`
3. **Formato:** Las API keys no deben tener comillas ni espacios alrededor del `=`
4. **Versión gratuita:** Los modelos de Gemini en free tier tienen límites de uso
5. **Modelos automáticos:** El sistema selecciona automáticamente el mejor modelo disponible

---

**Última actualización:** 2025-01-27
