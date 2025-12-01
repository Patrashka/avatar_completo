"""
Script para probar la API key de Gemini directamente
Ejecuta: python test_gemini_key.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Cargar .env
backend_dir = Path(__file__).parent
env_path = backend_dir / '.env'

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"✅ Cargado .env desde: {env_path}")
else:
    print(f"⚠️ No se encontró .env en: {env_path}")
    print("Intentando cargar desde variables de entorno del sistema...")

# Obtener API key
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")

if not api_key:
    print("❌ ERROR: No se encontró GEMINI_API_KEY en .env")
    print("\n💡 Solución:")
    print("   1. Crea o edita backend/.env")
    print("   2. Agrega: GEMINI_API_KEY=tu_api_key_aqui")
    sys.exit(1)

# Limpiar API key
api_key = api_key.strip()
if api_key.startswith('"') and api_key.endswith('"'):
    api_key = api_key[1:-1].strip()
elif api_key.startswith("'") and api_key.endswith("'"):
    api_key = api_key[1:-1].strip()

print(f"\n🔑 API Key encontrada:")
print(f"   Longitud: {len(api_key)} caracteres")
print(f"   Primeros 10 chars: {api_key[:10]}...")
print(f"   Últimos 10 chars: ...{api_key[-10:]}")

# Validar formato
if not api_key.startswith("AIza"):
    print("\n⚠️ ADVERTENCIA: La API key no empieza con 'AIza'")
    print("   Las API keys de Google Gemini suelen empezar con 'AIza'")

if len(api_key) < 20:
    print("\n⚠️ ADVERTENCIA: La API key parece muy corta")
    print("   Las API keys de Gemini suelen tener ~39 caracteres")

# Configurar Gemini
print("\n🔧 Configurando Gemini...")
try:
    genai.configure(api_key=api_key)
    print("✅ Gemini configurado correctamente")
except Exception as e:
    print(f"❌ Error configurando Gemini: {e}")
    sys.exit(1)

# Probar diferentes modelos disponibles (priorizar free tier)
models_to_try = [
    "gemini-2.5-flash",      # Modelo Flash más reciente (free tier)
    "gemini-2.5-flash-lite", # Versión ligera (free tier)
    "gemini-1.5-flash",      # Flash anterior
    "gemini-pro",            # Modelo base (más compatible)
    "gemini-1.5-pro",        # Pro anterior
    "gemini-2.0-flash-exp"   # Experimental
]

print("\n🧪 Probando modelos disponibles...")
model = None
model_name = None

for model_name in models_to_try:
    try:
        print(f"   Intentando {model_name}...")
        model = genai.GenerativeModel(model_name)
        print(f"✅ Modelo {model_name} creado correctamente")
        break
    except Exception as e:
        print(f"   ❌ {model_name} no disponible: {str(e)[:100]}")
        continue

if not model:
    print("\n❌ Ningún modelo funcionó. Verificando modelos disponibles...")
    try:
        models = genai.list_models()
        print("\n📋 Modelos disponibles:")
        for m in models:
            if 'generateContent' in m.supported_generation_methods:
                print(f"   - {m.name}")
    except Exception as e:
        print(f"   Error listando modelos: {e}")
    sys.exit(1)

# Hacer una llamada de prueba
print("\n📡 Haciendo llamada de prueba a Gemini...")
try:
    response = model.generate_content("Responde solo con 'OK' si funciono correctamente")
    text = (response.text or "").strip()
    print(f"✅ Respuesta recibida: {text}")
    print("\n🎉 ¡La API key funciona correctamente!")
except Exception as e:
    error_str = str(e)
    print(f"\n❌ ERROR al llamar a Gemini:")
    print(f"   {error_str}")
    
    if "API key not valid" in error_str or "API_KEY_INVALID" in error_str:
        print("\n💡 SOLUCIÓN:")
        print("   1. Verifica que la API key sea correcta:")
        print("      https://makersuite.google.com/app/apikey")
        print("\n   2. Verifica que la API key tenga habilitada 'Generative Language API':")
        print("      https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com")
        print("\n   3. Verifica que la API key no esté restringida:")
        print("      https://console.cloud.google.com/apis/credentials")
        print("      - No debe tener restricciones de IP (a menos que sea necesario)")
        print("      - No debe tener restricciones de dominio")
        print("\n   4. Verifica que tengas créditos/quota disponible")
        print("      https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas")
    elif "quota" in error_str.lower() or "rate limit" in error_str.lower():
        print("\n💡 SOLUCIÓN:")
        print("   Has excedido el límite de quota. Espera unos minutos o verifica tu quota:")
        print("   https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas")
    else:
        print("\n💡 Revisa los detalles del error arriba para más información")
    
    sys.exit(1)

print("\n✅ Todas las pruebas pasaron. La API key está funcionando correctamente.")

