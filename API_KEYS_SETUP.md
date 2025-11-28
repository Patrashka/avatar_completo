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
La API key viene en formato `email:api_key` (codificado en base64)

**¿Dónde configurarla?**
- **Archivo:** `avatar_completo/frontend/.env`
- **Variable:** `VITE_DID_API_KEY`

**Ejemplo:**
```env
VITE_DID_API_KEY=dmluaWNpby5jYW50dUB1ZGVtLmVkdQ:xSGXERmQ_Iv3I1X6Codcb
```

**Configurar imagen personalizada del avatar (OPCIONAL):**
- **Variable:** `VITE_DID_AVATAR_IMAGE_URL`
- **Opciones:**
  1. **URL pública:** Usa una URL de una imagen accesible desde internet
  2. **Imagen en D-ID:** Sube tu imagen a https://studio.d-id.com/ y copia la URL
  3. **Dejar vacío:** Usa la imagen predeterminada

**Ejemplo:**
```env
VITE_DID_AVATAR_IMAGE_URL=https://ejemplo.com/mi-foto.jpg
```

**Requisitos de la imagen:**
- Formato: JPG, PNG, WebP
- Tamaño recomendado: 512x512px o mayor (cuadrada funciona mejor)
- Debe ser una URL pública accesible desde internet
- La imagen debe mostrar claramente el rostro de frente

---

### 2. **OpenAI API Key** (OBLIGATORIO para el backend de IA)

**¿Qué es?**  
La API key de OpenAI se usa para el procesamiento de lenguaje natural y análisis de IA (GPT-4).

**¿Dónde obtenerla?**
1. Ve a https://platform.openai.com/api-keys
2. Inicia sesión con tu cuenta de OpenAI
3. Crea una nueva API key (Secret Key)

**¿Dónde configurarla?**
- **Archivo:** `avatar_completo/backend/.env`
- **Variable:** `OPENAI_API_KEY`

**Ejemplo:**
```env
OPENAI_API_KEY=sk-proj-XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Nota:** Asegúrate de tener créditos en tu cuenta de OpenAI. El modelo usado es `gpt-4o-mini` para texto y `gpt-4o` para análisis de imágenes.

---

### 3. **MongoDB** (Opcional - ya está configurado)

Si usas la configuración por defecto de Docker, no necesitas cambiar nada.  
Si usas MongoDB externo, configura:

**Archivo:** `avatar_completo/backend/.env`

**Opción 1 - URI completa:**
```env
MONGO_URI=mongodb://usuario:password@host:puerto/database?authSource=admin
```

**Opción 2 - Parámetros individuales:**
```env
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=medico_mongo
MONGO_USER=admin
MONGO_PASSWORD=admin123
```

---

## 🚀 Pasos para Configurar

### Paso 1: Frontend

1. Ve a `avatar_completo/frontend/`
2. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
3. Edita `.env` y agrega tu D-ID API Key:
   ```env
   VITE_DID_API_KEY=tu_api_key_aqui
   ```

### Paso 2: Backend

1. Ve a `avatar_completo/backend/`
2. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
3. Edita `.env` y agrega tu Google Gemini API Key:
   ```env
   GOOGLE_GEMINI_API_KEY=tu_api_key_aqui
   ```

### Paso 3: Reiniciar Servicios

Después de configurar las variables de entorno, reinicia los servicios:

```powershell
# Detener todos los servicios
.\start_all_services.ps1 -Stop

# Iniciar todos los servicios
.\start_all_services.ps1
```

---

## ⚠️ Importante

1. **Nunca subas los archivos `.env` a Git** - Ya están en `.gitignore`
2. **Mantén tus API keys seguras** - No las compartas públicamente
3. **Verifica que los archivos `.env` existan** - Si no existen, créalos desde los `.env.example`

---

## ✅ Verificación

Para verificar que todo está configurado correctamente:

1. **Frontend:** Abre la consola del navegador y verifica que no haya errores de API key
2. **Backend:** Revisa los logs del backend para verificar que MongoDB y Gemini estén conectados

---

## 📞 Soporte

Si tienes problemas:
1. Verifica que las API keys sean válidas
2. Revisa que los archivos `.env` estén en las ubicaciones correctas
3. Asegúrate de haber reiniciado los servicios después de cambiar las variables

