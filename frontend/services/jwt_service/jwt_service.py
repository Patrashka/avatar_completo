"""
Servicio de gestión de JWT Tokens
Maneja la generación, validación y refresh de tokens JWT
"""
import os
import jwt
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class JWTService:
    """Servicio para gestión de tokens JWT"""
    
    def __init__(self, redis_service):
        """
        Inicializa el servicio JWT
        
        Args:
            redis_service: Instancia de RedisService para almacenar tokens
        """
        self.redis_service = redis_service
        self.secret_key = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        self.algorithm = os.getenv('JWT_ALGORITHM', 'HS256')
        
        # Tiempos de expiración (en segundos)
        self.access_token_expiry = int(os.getenv('ACCESS_TOKEN_EXPIRY', 3600))  # 1 hora por defecto
        self.refresh_token_expiry = int(os.getenv('REFRESH_TOKEN_EXPIRY', 604800))  # 7 días por defecto
    
    def generate_tokens(self, user_id: str, username: str, role: str = "user", 
                       metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Genera un par de tokens (access y refresh)
        
        Args:
            user_id: ID del usuario
            username: Nombre de usuario
            role: Rol del usuario
            metadata: Metadatos adicionales del usuario
        
        Returns:
            Dict con access_token, refresh_token y expires_in
        """
        now = datetime.utcnow()
        
        # Payload del access token
        access_payload = {
            'user_id': str(user_id),
            'username': username,
            'role': role,
            'type': 'access',
            'iat': now,
            'exp': now + timedelta(seconds=self.access_token_expiry),
            'metadata': metadata or {}
        }
        
        # Payload del refresh token
        refresh_payload = {
            'user_id': str(user_id),
            'username': username,
            'type': 'refresh',
            'iat': now,
            'exp': now + timedelta(seconds=self.refresh_token_expiry)
        }
        
        # Generar tokens
        access_token = jwt.encode(access_payload, self.secret_key, algorithm=self.algorithm)
        refresh_token = jwt.encode(refresh_payload, self.secret_key, algorithm=self.algorithm)
        
        # Almacenar tokens en Redis
        # Access token con expiración
        self.redis_service.store_token(
            f"access_token:{user_id}:{access_token}",
            access_token,
            self.access_token_expiry
        )
        
        # Refresh token con expiración
        self.redis_service.store_token(
            f"refresh_token:{user_id}:{refresh_token}",
            refresh_token,
            self.refresh_token_expiry
        )
        
        # Almacenar relación usuario-token para poder revocar todos los tokens de un usuario
        self.redis_service.store_user_tokens(user_id, access_token, refresh_token)
        
        logger.info(f"Tokens generados para usuario: {username} (ID: {user_id})")
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': self.access_token_expiry
        }
    
    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Valida un token JWT
        
        Args:
            token: Token JWT a validar
        
        Returns:
            Payload del token si es válido, None en caso contrario
        """
        try:
            # Decodificar token
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Verificar que el token no esté en la blacklist
            user_id = payload.get('user_id')
            token_type = payload.get('type', 'access')
            
            if token_type == 'access':
                key = f"access_token:{user_id}:{token}"
            else:
                key = f"refresh_token:{user_id}:{token}"
            
            # Verificar si el token existe en Redis (no ha sido revocado)
            if not self.redis_service.token_exists(key):
                logger.warning(f"Token no encontrado en Redis (posiblemente revocado): {key}")
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token expirado")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Token inválido: {e}")
            return None
        except Exception as e:
            logger.error(f"Error validando token: {e}")
            return None
    
    def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """
        Genera un nuevo access token usando un refresh token
        
        Args:
            refresh_token: Refresh token válido
        
        Returns:
            Dict con nuevo access_token y expires_in, o None si el refresh token es inválido
        """
        try:
            # Validar refresh token
            payload = self.validate_token(refresh_token)
            
            if not payload or payload.get('type') != 'refresh':
                logger.warning("Refresh token inválido")
                return None
            
            user_id = payload.get('user_id')
            username = payload.get('username')
            
            # Obtener metadata del usuario desde Redis si está disponible
            user_data = self.redis_service.get_user_data(user_id)
            metadata = user_data.get('metadata', {}) if user_data else {}
            role = user_data.get('role', 'user') if user_data else 'user'
            
            # Generar nuevo access token
            now = datetime.utcnow()
            access_payload = {
                'user_id': str(user_id),
                'username': username,
                'role': role,
                'type': 'access',
                'iat': now,
                'exp': now + timedelta(seconds=self.access_token_expiry),
                'metadata': metadata
            }
            
            new_access_token = jwt.encode(access_payload, self.secret_key, algorithm=self.algorithm)
            
            # Almacenar nuevo access token en Redis
            self.redis_service.store_token(
                f"access_token:{user_id}:{new_access_token}",
                new_access_token,
                self.access_token_expiry
            )
            
            # Actualizar relación usuario-token
            self.redis_service.store_user_tokens(user_id, new_access_token, refresh_token)
            
            logger.info(f"Nuevo access token generado para usuario: {username} (ID: {user_id})")
            
            return {
                'access_token': new_access_token,
                'expires_in': self.access_token_expiry
            }
            
        except Exception as e:
            logger.error(f"Error refrescando token: {e}")
            return None
    
    def revoke_token(self, token: str) -> bool:
        """
        Revoca un token (lo agrega a la blacklist)
        
        Args:
            token: Token a revocar
        
        Returns:
            True si se revocó exitosamente, False en caso contrario
        """
        try:
            # Decodificar token para obtener información
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm], 
                               options={"verify_exp": False})
            
            user_id = payload.get('user_id')
            token_type = payload.get('type', 'access')
            
            if token_type == 'access':
                key = f"access_token:{user_id}:{token}"
            else:
                key = f"refresh_token:{user_id}:{token}"
            
            # Eliminar token de Redis
            success = self.redis_service.delete_token(key)
            
            if success:
                logger.info(f"Token revocado para usuario: {user_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error revocando token: {e}")
            return False
    
    def revoke_all_user_tokens(self, user_id: str) -> bool:
        """
        Revoca todos los tokens de un usuario
        
        Args:
            user_id: ID del usuario
        
        Returns:
            True si se revocaron exitosamente, False en caso contrario
        """
        try:
            return self.redis_service.revoke_all_user_tokens(user_id)
        except Exception as e:
            logger.error(f"Error revocando todos los tokens del usuario {user_id}: {e}")
            return False

