"""
Servicio de integración con Redis
Maneja el almacenamiento y recuperación de tokens en Redis
"""
import os
import redis
import json
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class RedisService:
    """Servicio para gestión de Redis"""
    
    def __init__(self):
        """Inicializa la conexión con Redis"""
        # Configuración desde variables de entorno
        redis_host = os.getenv('REDIS_HOST', 'localhost')
        redis_port = int(os.getenv('REDIS_PORT', 6379))
        redis_username = os.getenv('REDIS_USERNAME', None)
        redis_password = os.getenv('REDIS_PASSWORD', None)
        redis_db = int(os.getenv('REDIS_DB', 0))
        # Leer configuración SSL (respetar explícitamente lo configurado)
        redis_ssl_env = os.getenv('REDIS_SSL', '').lower()
        if redis_ssl_env == 'true':
            redis_ssl = True
        elif redis_ssl_env == 'false':
            redis_ssl = False
        else:
            # Si no está configurado explícitamente, para Redis Cloud usar SSL por defecto
            redis_ssl = 'redislabs.com' in redis_host or 'redis.cloud' in redis_host
        
        try:
            # Para Redis Cloud, usar URL de conexión es más confiable
            if 'redislabs.com' in redis_host or 'redis.cloud' in redis_host:
                # Construir URL de conexión
                protocol = 'rediss' if redis_ssl else 'redis'
                if redis_username and redis_password:
                    # URL con username:password
                    redis_url = f"{protocol}://{redis_username}:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
                elif redis_password:
                    # URL solo con password
                    redis_url = f"{protocol}://:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
                else:
                    redis_url = f"{protocol}://{redis_host}:{redis_port}/{redis_db}"
                
                # Configurar parámetros SSL para URL
                ssl_params = {}
                if redis_ssl:
                    ssl_params = {
                        'ssl_cert_reqs': None,
                        'ssl_check_hostname': False
                    }
                
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_timeout=5,
                    socket_connect_timeout=5,
                    **ssl_params
                )
            else:
                # Configurar parámetros SSL para conexión tradicional
                redis_kwargs = {
                    'host': redis_host,
                    'port': redis_port,
                    'db': redis_db,
                    'decode_responses': True,
                    'socket_timeout': 5,
                    'socket_connect_timeout': 5
                }
                
                # Configurar autenticación (username y password para Redis 6+)
                if redis_username and redis_password:
                    # Redis 6+ con ACL (username:password)
                    redis_kwargs['username'] = redis_username
                    redis_kwargs['password'] = redis_password
                elif redis_password:
                    # Redis tradicional (solo password)
                    redis_kwargs['password'] = redis_password
                
                if redis_ssl:
                    redis_kwargs['ssl'] = True
                    redis_kwargs['ssl_cert_reqs'] = None
                    redis_kwargs['ssl_check_hostname'] = False
                
                self.redis_client = redis.Redis(**redis_kwargs)
            
            # Probar conexión
            self.redis_client.ping()
            logger.info(f"Conectado a Redis en {redis_host}:{redis_port}")
            
        except redis.ConnectionError as e:
            logger.error(f"Error conectando a Redis: {e}")
            raise
        except Exception as e:
            logger.error(f"Error inicializando Redis: {e}")
            raise
    
    def check_connection(self) -> bool:
        """Verifica si la conexión con Redis está activa"""
        try:
            self.redis_client.ping()
            return True
        except Exception:
            return False
    
    def store_token(self, key: str, token: str, expiry: int) -> bool:
        """
        Almacena un token en Redis con expiración
        
        Args:
            key: Clave del token
            token: Valor del token
            expiry: Tiempo de expiración en segundos
        
        Returns:
            True si se almacenó exitosamente
        """
        try:
            self.redis_client.setex(key, expiry, token)
            return True
        except Exception as e:
            logger.error(f"Error almacenando token: {e}")
            return False
    
    def get_token(self, key: str) -> Optional[str]:
        """
        Obtiene un token de Redis
        
        Args:
            key: Clave del token
        
        Returns:
            Token si existe, None en caso contrario
        """
        try:
            return self.redis_client.get(key)
        except Exception as e:
            logger.error(f"Error obteniendo token: {e}")
            return None
    
    def token_exists(self, key: str) -> bool:
        """
        Verifica si un token existe en Redis
        
        Args:
            key: Clave del token
        
        Returns:
            True si existe, False en caso contrario
        """
        try:
            return self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"Error verificando existencia de token: {e}")
            return False
    
    def delete_token(self, key: str) -> bool:
        """
        Elimina un token de Redis
        
        Args:
            key: Clave del token
        
        Returns:
            True si se eliminó exitosamente
        """
        try:
            return self.redis_client.delete(key) > 0
        except Exception as e:
            logger.error(f"Error eliminando token: {e}")
            return False
    
    def store_user_tokens(self, user_id: str, access_token: str, refresh_token: str) -> bool:
        """
        Almacena la relación usuario-tokens para poder revocar todos los tokens
        
        Args:
            user_id: ID del usuario
            access_token: Access token del usuario
            refresh_token: Refresh token del usuario
        
        Returns:
            True si se almacenó exitosamente
        """
        try:
            # Almacenar tokens en un set para el usuario
            user_tokens_key = f"user_tokens:{user_id}"
            
            # Agregar tokens al set
            self.redis_client.sadd(user_tokens_key, access_token, refresh_token)
            
            # Establecer expiración (usar la del refresh token que es más larga)
            refresh_expiry = int(os.getenv('REFRESH_TOKEN_EXPIRY', 604800))
            self.redis_client.expire(user_tokens_key, refresh_expiry)
            
            return True
        except Exception as e:
            logger.error(f"Error almacenando tokens de usuario: {e}")
            return False
    
    def get_user_tokens(self, user_id: str) -> List[str]:
        """
        Obtiene todos los tokens de un usuario
        
        Args:
            user_id: ID del usuario
        
        Returns:
            Lista de tokens del usuario
        """
        try:
            user_tokens_key = f"user_tokens:{user_id}"
            return list(self.redis_client.smembers(user_tokens_key))
        except Exception as e:
            logger.error(f"Error obteniendo tokens de usuario: {e}")
            return []
    
    def revoke_all_user_tokens(self, user_id: str) -> bool:
        """
        Revoca todos los tokens de un usuario
        
        Args:
            user_id: ID del usuario
        
        Returns:
            True si se revocaron exitosamente
        """
        try:
            tokens = self.get_user_tokens(user_id)
            
            # Eliminar cada token
            for token in tokens:
                # Intentar eliminar como access token
                self.delete_token(f"access_token:{user_id}:{token}")
                # Intentar eliminar como refresh token
                self.delete_token(f"refresh_token:{user_id}:{token}")
            
            # Eliminar el set de tokens del usuario
            user_tokens_key = f"user_tokens:{user_id}"
            self.redis_client.delete(user_tokens_key)
            
            logger.info(f"Todos los tokens revocados para usuario: {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error revocando todos los tokens del usuario: {e}")
            return False
    
    def store_user_data(self, user_id: str, user_data: Dict[str, Any], expiry: int = 3600) -> bool:
        """
        Almacena datos del usuario en Redis
        
        Args:
            user_id: ID del usuario
            user_data: Datos del usuario
            expiry: Tiempo de expiración en segundos
        
        Returns:
            True si se almacenó exitosamente
        """
        try:
            key = f"user_data:{user_id}"
            self.redis_client.setex(key, expiry, json.dumps(user_data))
            return True
        except Exception as e:
            logger.error(f"Error almacenando datos de usuario: {e}")
            return False
    
    def get_user_data(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene datos del usuario de Redis
        
        Args:
            user_id: ID del usuario
        
        Returns:
            Datos del usuario si existen, None en caso contrario
        """
        try:
            key = f"user_data:{user_id}"
            data = self.redis_client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Error obteniendo datos de usuario: {e}")
            return None

