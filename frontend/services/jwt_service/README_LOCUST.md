# Pruebas de Carga con Locust - JWT Service

## Instalación

```bash
pip install locust
```

## Ejecutar Pruebas

### Opción 1: Interfaz Web con Navegador Automático (Más Fácil)

```powershell
cd frontend/services/jwt_service

# Inicia Locust y abre el navegador automáticamente
.\start_locust_web.ps1
```

Esto abrirá automáticamente http://localhost:8089 en tu navegador.

### Opción 2: Usar el Script PowerShell

```powershell
cd frontend/services/jwt_service

# Interfaz web interactiva
.\run_load_test.ps1 web

# Prueba básica (1 usuario, 30s)
.\run_load_test.ps1 basic

# Prueba de carga (10 usuarios, 2m)
.\run_load_test.ps1 load

# Prueba de estrés (50 usuarios, 5m)
.\run_load_test.ps1 stress

# Personalizado
.\run_load_test.ps1 load 20 3m  # 20 usuarios, 3 minutos
```

### Opción 2: Comandos Directos

#### 1. Prueba Básica (1 usuario)

```bash
cd frontend/services/jwt_service
python -m locust -f locustfile.py --host=http://127.0.0.1:8014 --users 1 --spawn-rate 1 --headless --run-time 30s
```

#### 2. Prueba de Carga (10 usuarios simultáneos)

```bash
python -m locust -f locustfile.py --host=http://127.0.0.1:8014 --users 10 --spawn-rate 2 --headless --run-time 2m
```

#### 3. Prueba de Estrés (50 usuarios)

```bash
python -m locust -f locustfile.py --host=http://127.0.0.1:8014 --users 50 --spawn-rate 5 --headless --run-time 5m
```

#### 4. Interfaz Web (Recomendado)

```bash
python -m locust -f locustfile.py --host=http://127.0.0.1:8014
```

Luego abre: http://localhost:8089

## Prueba Directa de Redis

```bash
cd frontend/services/jwt_service
python test_redis_direct.py
```

## Parámetros de Locust

- `--users`: Número total de usuarios simulados
- `--spawn-rate`: Usuarios creados por segundo
- `--headless`: Modo sin interfaz (solo resultados)
- `--run-time`: Duración de la prueba (ej: 2m, 30s)
- `--host`: URL base del servicio a probar

## Interpretación de Resultados

- **RPS (Requests Per Second)**: Peticiones por segundo
- **Response Time**: Tiempo de respuesta (ms)
- **Failure Rate**: Porcentaje de fallos
- **Redis Status**: Verifica que Redis esté "connected" en /health

