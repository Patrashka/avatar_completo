# D-ID Conversations Service

Servicio para gestionar y almacenar conversaciones del avatar D-ID en MongoDB.

## 📁 Estructura

```
did_conversations_service/
├── conversation-service.js    # Servicio principal de MongoDB
├── README.md                  # Esta documentación
└── package.json               # Dependencias (si se usa como módulo independiente)
```

## 🔌 Integración

Este servicio se integra con:
- **Backend de live-streaming-demo-did**: Usa este servicio para guardar conversaciones
- **MongoDB de avatar_completo**: Almacena las conversaciones en la colección `did_conversations`

## 📋 Uso

### En Node.js/Express

```javascript
const conversationService = require('./did_conversations_service/conversation-service');

// Guardar un mensaje
await conversationService.saveMessage({
  agentId: 'agt_xxx',
  chatId: 'cht_xxx',
  userId: 123,
  patientId: 456,
  role: 'user',
  content: 'Hola, ¿cómo estás?',
  audio: null, // opcional
  timestamp: new Date()
});

// Obtener conversación
const conversation = await conversationService.getConversation('agt_xxx', 'cht_xxx');

// Obtener conversaciones de usuario
const userConversations = await conversationService.getUserConversations(123, 50);
```

## 🔧 Configuración

El servicio usa las mismas variables de entorno que `avatar_completo`:

```env
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=medico_mongo
MONGO_USER=app_user
MONGO_PASSWORD=app_password
```

Si `app_user` no está disponible, automáticamente intenta con `admin:admin123`.

## 📊 Estructura de Datos

Las conversaciones se almacenan en MongoDB con la siguiente estructura:

```javascript
{
  _id: ObjectId,
  agentId: String,        // ID del agente D-ID
  chatId: String,         // ID del chat D-ID
  userId: Number,         // ID del usuario (opcional)
  patientId: Number,      // ID del paciente (opcional)
  messages: [
    {
      role: "user" | "assistant",
      content: String,
      audio: String (base64, opcional),
      timestamp: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

## 🔗 Relación con otros componentes

- **live-streaming-demo-did/app.js**: Importa y usa este servicio
- **avatar_completo/database/scripts/init/init-mongo.js**: Crea la colección `did_conversations`
- **live-streaming-demo-did/agents-client-api.js**: Llama a los endpoints que usan este servicio

## 📝 Notas

- El servicio maneja automáticamente la conexión a MongoDB
- Si la conexión falla, se registra un error pero no bloquea la aplicación
- Los mensajes se agregan a la conversación existente o se crea una nueva si no existe

