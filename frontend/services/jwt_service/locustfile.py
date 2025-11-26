"""
Pruebas de carga con Locust para el servicio JWT-Redis
Prueba endpoints de autenticación y verificación de Redis
"""
from locust import HttpUser, task, between
import random
import json

class JWTServiceUser(HttpUser):
    """
    Usuario simulado que prueba el servicio JWT-Redis
    """
    wait_time = between(1, 3)  # Espera entre 1 y 3 segundos entre requests
    
    def on_start(self):
        """Se ejecuta al inicio de cada usuario simulado"""
        self.access_token = None
        self.refresh_token = None
        self.user_id = None
        self.username = f"test_user_{random.randint(1000, 9999)}"
        
        # Intentar hacer login para obtener tokens
        self.login()
    
    def login(self):
        """Prueba el endpoint de login"""
        payload = {
            "username": self.username,
            "password": "password123",
            "user_id": random.randint(1, 100),
            "role": random.choice(["paciente", "doctor", "admin"]),
            "metadata": {
                "test": True,
                "load_test": True
            }
        }
        
        with self.client.post(
            "/api/auth/login",
            json=payload,
            catch_response=True,
            name="POST /api/auth/login"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                self.user_id = payload["user_id"]
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")
    
    @task(3)
    def validate_token(self):
        """Prueba la validación de token (alta frecuencia)"""
        if not self.access_token:
            return
        
        with self.client.post(
            "/api/auth/validate",
            json={"token": self.access_token},
            headers={"Authorization": f"Bearer {self.access_token}"},
            catch_response=True,
            name="POST /api/auth/validate"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("valid"):
                    response.success()
                else:
                    response.failure("Token invalid")
            else:
                response.failure(f"Validate failed: {response.status_code}")
    
    @task(2)
    def get_user_info(self):
        """Prueba obtener información del usuario"""
        if not self.access_token:
            return
        
        with self.client.get(
            "/api/auth/user-info",
            headers={"Authorization": f"Bearer {self.access_token}"},
            catch_response=True,
            name="GET /api/auth/user-info"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Get user info failed: {response.status_code}")
    
    @task(1)
    def refresh_token(self):
        """Prueba el refresh del token (baja frecuencia)"""
        if not self.refresh_token:
            return
        
        with self.client.post(
            "/api/auth/refresh",
            json={"refresh_token": self.refresh_token},
            catch_response=True,
            name="POST /api/auth/refresh"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("access_token"):
                    self.access_token = data.get("access_token")
                    response.success()
                else:
                    response.failure("No access token in response")
            else:
                response.failure(f"Refresh failed: {response.status_code}")
    
    @task(1)
    def health_check(self):
        """Prueba el endpoint de health (verifica Redis)"""
        with self.client.get(
            "/health",
            catch_response=True,
            name="GET /health"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                redis_status = data.get("redis", "unknown")
                if redis_status == "connected":
                    response.success()
                else:
                    response.failure(f"Redis not connected: {redis_status}")
            else:
                response.failure(f"Health check failed: {response.status_code}")
    
    def on_stop(self):
        """Se ejecuta al finalizar cada usuario simulado"""
        # Opcional: hacer logout para limpiar tokens
        if self.access_token:
            try:
                self.client.post(
                    "/api/auth/logout",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    name="POST /api/auth/logout"
                )
            except:
                pass

