/**
 * Servicio para gestionar conversaciones con D-ID Agents
 * Guarda y recupera conversaciones desde MongoDB
 */

const { MongoClient } = require('mongodb');

class ConversationService {
    constructor() {
        this.client = null;
        this.db = null;
        this.collection = null;
        this.isConnected = false;
        
        // Configuración de MongoDB (usar las mismas credenciales de avatar_completo)
        this.mongoConfig = {
            host: process.env.MONGO_HOST || 'localhost',
            port: process.env.MONGO_PORT || '27017',
            db: process.env.MONGO_DB || 'medico_mongo',
            user: process.env.MONGO_USER || 'app_user',
            password: process.env.MONGO_PASSWORD || 'app_password',
            // Fallback a admin si app_user falla
            adminUser: 'admin',
            adminPassword: 'admin123'
        };
    }

    /**
     * Conecta a MongoDB
     */
    async connect() {
        if (this.isConnected && this.client) {
            return;
        }

        try {
            // Intentar primero con app_user
            let mongoUri = `mongodb://${this.mongoConfig.user}:${this.mongoConfig.password}@${this.mongoConfig.host}:${this.mongoConfig.port}/${this.mongoConfig.db}?authSource=admin`;
            
            this.client = new MongoClient(mongoUri, {
                serverSelectionTimeoutMS: 5000
            });

            await this.client.connect();
            await this.client.db('admin').admin().ping();
            
            this.db = this.client.db(this.mongoConfig.db);
            this.collection = this.db.collection('did_conversations');
            this.isConnected = true;
            
            console.log('✅ Conexión a MongoDB establecida (app_user)');
        } catch (error) {
            // Si falla, intentar con admin
            console.warn('⚠️ Falló conexión con app_user, intentando con admin...');
            try {
                mongoUri = `mongodb://${this.mongoConfig.adminUser}:${this.mongoConfig.adminPassword}@${this.mongoConfig.host}:${this.mongoConfig.port}/${this.mongoConfig.db}?authSource=admin`;
                
                this.client = new MongoClient(mongoUri, {
                    serverSelectionTimeoutMS: 5000
                });

                await this.client.connect();
                await this.client.db('admin').admin().ping();
                
                this.db = this.client.db(this.mongoConfig.db);
                this.collection = this.db.collection('did_conversations');
                this.isConnected = true;
                
                console.log('✅ Conexión a MongoDB establecida (admin)');
            } catch (adminError) {
                console.error('❌ Error conectando a MongoDB:', adminError);
                this.isConnected = false;
                throw adminError;
            }
        }
    }

    /**
     * Guarda un mensaje en la conversación
     * @param {Object} messageData - Datos del mensaje
     * @returns {Promise<string>} ID del mensaje guardado
     */
    async saveMessage(messageData) {
        if (!this.isConnected) {
            await this.connect();
        }

        const {
            agentId,
            chatId,
            userId = null,
            patientId = null,
            role, // 'user' o 'assistant'
            content,
            audio = null,
            timestamp = new Date()
        } = messageData;

        // Buscar o crear la conversación
        let conversation = await this.collection.findOne({
            agentId: agentId,
            chatId: chatId
        });

        if (!conversation) {
            // Crear nueva conversación
            conversation = {
                agentId: agentId,
                chatId: chatId,
                userId: userId,
                patientId: patientId,
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await this.collection.insertOne(conversation);
            conversation._id = result.insertedId;
        }

        // Agregar el nuevo mensaje
        const message = {
            role: role,
            content: content,
            timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp),
            ...(audio && { audio: audio })
        };

        // Actualizar la conversación con el nuevo mensaje
        await this.collection.updateOne(
            { _id: conversation._id },
            {
                $push: { messages: message },
                $set: { 
                    updatedAt: new Date(),
                    ...(userId && { userId: userId }),
                    ...(patientId && { patientId: patientId })
                }
            }
        );

        return conversation._id.toString();
    }

    /**
     * Obtiene una conversación completa
     * @param {string} agentId - ID del agente
     * @param {string} chatId - ID del chat
     * @returns {Promise<Object|null>} Conversación o null si no existe
     */
    async getConversation(agentId, chatId) {
        if (!this.isConnected) {
            await this.connect();
        }

        const conversation = await this.collection.findOne({
            agentId: agentId,
            chatId: chatId
        });

        if (!conversation) {
            return null;
        }

        // Convertir ObjectId a string
        return {
            id: conversation._id.toString(),
            agentId: conversation.agentId,
            chatId: conversation.chatId,
            userId: conversation.userId,
            patientId: conversation.patientId,
            messages: conversation.messages || [],
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
        };
    }

    /**
     * Obtiene todas las conversaciones de un usuario
     * @param {number} userId - ID del usuario
     * @param {number} limit - Límite de resultados
     * @returns {Promise<Array>} Lista de conversaciones
     */
    async getUserConversations(userId, limit = 50) {
        if (!this.isConnected) {
            await this.connect();
        }

        const conversations = await this.collection
            .find({ userId: userId })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .toArray();

        return conversations.map(conv => ({
            id: conv._id.toString(),
            agentId: conv.agentId,
            chatId: conv.chatId,
            userId: conv.userId,
            patientId: conv.patientId,
            messageCount: conv.messages ? conv.messages.length : 0,
            lastMessage: conv.messages && conv.messages.length > 0 
                ? conv.messages[conv.messages.length - 1] 
                : null,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
        }));
    }

    /**
     * Obtiene todas las conversaciones de un paciente
     * @param {number} patientId - ID del paciente
     * @param {number} limit - Límite de resultados
     * @returns {Promise<Array>} Lista de conversaciones
     */
    async getPatientConversations(patientId, limit = 50) {
        if (!this.isConnected) {
            await this.connect();
        }

        const conversations = await this.collection
            .find({ patientId: patientId })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .toArray();

        return conversations.map(conv => ({
            id: conv._id.toString(),
            agentId: conv.agentId,
            chatId: conv.chatId,
            userId: conv.userId,
            patientId: conv.patientId,
            messageCount: conv.messages ? conv.messages.length : 0,
            lastMessage: conv.messages && conv.messages.length > 0 
                ? conv.messages[conv.messages.length - 1] 
                : null,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
        }));
    }

    /**
     * Cierra la conexión a MongoDB
     */
    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.isConnected = false;
            this.client = null;
            this.db = null;
            this.collection = null;
            console.log('🔌 Desconectado de MongoDB');
        }
    }
}

// Crear instancia singleton
const conversationService = new ConversationService();

module.exports = conversationService;

