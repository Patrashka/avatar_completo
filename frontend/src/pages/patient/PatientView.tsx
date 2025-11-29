import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { api } from "../../services/api";
import toast from "react-hot-toast";

// Tipos basados en DoctorDashboard
type Catalogo = { id: number; nombre: string };
type Archivo = { id: number; tipo: string; url: string; hash_integridad: string; creado_en: string };
type ArchivoAsoc = { id: number; archivo_id: number; entidad: string; entidad_id: number; descripcion: string; creado_por_usuario_id: number; fecha_creacion: string };
type Interpretacion = { id: number; id_archivo: number; id_medico: number; id_consulta: number; fuente: string; resultado: string; fecha: string };

type State = {
  PACIENTE: {
    id: number; usuario_id: number; nombre: string; apellido: string; fecha_nacimiento: string;
    sexo: string; altura: string; peso: string; estilo_vida: string; id_tipo_sangre: number;
    id_ocupacion: number; id_estado_civil: number; id_medico_gen: number; foto_archivo_id: number | null;
  };
  CONSULTA: {
    id: number; cita_id: number; id_estado_consulta: number; id_episodio: number; fecha_hora: string;
    narrativa: string; mongo_consulta_id: string; diagnostico_final: string;
  };
  EPISODIO: { id: number; id_paciente: number; fecha_inicio: string; fecha_fin: string | ""; motivo: string };
  ARCHIVO: Archivo[];
  ARCHIVO_ASOCIACION: ArchivoAsoc[];
  INTERPRETACION_ARCHIVO: Interpretacion[];
  CLINICA: { id: number; nombre: string; telefono: string; correo: string };
  CATALOGOS: {
    ESTADO_CITA: Catalogo[];
    TIPO_CITA: Catalogo[];
    ESTADO_CONSULTA: Catalogo[];
    TIPO_SANGRE: Catalogo[];
    OCUPACION: Catalogo[];
    ESTADO_CIVIL: Catalogo[];
    MEDICO: Catalogo[];
  };
  AI: {
    preDiagnosis: string;
    symptoms: string[];
    suggestedICD10: string[];
    nextSteps: string[];
    risks: { name: string; score: number }[];
  };
};

type GeneralFormState = {
  id_estado_civil: string;
  id_ocupacion: string;
  id_tipo_sangre: string;
  altura: string;
  peso: string;
  estilo_vida: string;
};

// Estado inicial vacío - se carga desde la BD
const getInitialState = (): State => ({
  PACIENTE: {
    id: 0,
    usuario_id: 0,
    nombre: "",
    apellido: "",
    fecha_nacimiento: "",
    sexo: "",
    altura: "",
    peso: "",
    estilo_vida: "",
    id_tipo_sangre: 0,
    id_ocupacion: 0,
    id_estado_civil: 0,
    id_medico_gen: 0,
    foto_archivo_id: null,
  },
  CONSULTA: {
    id: 0,
    cita_id: 0,
    id_estado_consulta: 0,
    id_episodio: 0,
    fecha_hora: "",
    narrativa: "",
    mongo_consulta_id: "",
    diagnostico_final: "",
  },
  EPISODIO: {
    id: 0,
    id_paciente: 0,
    fecha_inicio: "",
    fecha_fin: "",
    motivo: "",
  },
  ARCHIVO: [],
  ARCHIVO_ASOCIACION: [],
  INTERPRETACION_ARCHIVO: [],
  CLINICA: { id: 0, nombre: "", telefono: "", correo: "" },
  CATALOGOS: {
    ESTADO_CITA: [],
    TIPO_CITA: [],
    ESTADO_CONSULTA: [],
    TIPO_SANGRE: [],
    OCUPACION: [],
    ESTADO_CIVIL: [],
    MEDICO: [],
  },
  AI: {
    preDiagnosis: "",
    symptoms: [],
    suggestedICD10: [],
    nextSteps: [],
    risks: [],
  },
});

// Utilidades
const fmt = (d: string) => new Date(d).toLocaleString();
const fmtDate = (d: string) => {
  try {
    const date = new Date(d);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

// Calcular edad desde fecha de nacimiento
const calculateAge = (fechaNacimiento: string): string => {
  try {
    const birth = new Date(fechaNacimiento);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years}y ${months}m ${days}d`;
  } catch {
    return "—";
  }
};

type ChatMessage = {
  sender: "user" | "avatar";
  text: string;
  timestamp: Date;
};

type ConversationRole = "user" | "agent";

type ConversationTurnPayload = {
  role: ConversationRole;
  text: string;
  patientId: number | null;
  consultaId: number | null;
  usuarioId: number | null;
  sessionUuid: string;
  messageId?: string | null;
  audioUrl?: string | null;
  agentSessionId?: string | null;
  agentConversationId?: string | null;
  agentUrl?: string;
  agentOrigin?: string;
  startedAt?: string;
  finishedAt?: string;
  metadata?: Record<string, unknown>;
};

const DID_EVENT_TYPES = new Set(["conversation.transcription", "conversation.agent_response"]);
const DID_DEFAULT_IFRAME_SRC = "https://nimble-gnome-492d1f.netlify.app/";
const DID_DEFAULT_ORIGIN = "https://agents.d-id.com";

const generateSessionUuid = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore - fallback will be used
  }
  return `did-session-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const toIsoString = (value?: number | string | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return new Date(value).toISOString();
  } catch {
    return undefined;
  }
};

export default function PatientView() {
  const [state, setState] = useState<State>(getInitialState());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"paciente" | "partes">("paciente");
  
  // ID del paciente - obtener del localStorage (sesión)
  const [PATIENT_ID, setPATIENT_ID] = useState<number | null>(() => {
    const stored = localStorage.getItem("patient_id");
    return stored ? parseInt(stored, 10) : null;
  });
  
  // Obtener información del usuario logueado
  const [userInfo, setUserInfo] = useState<{paciente_nombre?: string; foto_url?: string} | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  // Avatar médico en vivo
  const [avatarStatus, setAvatarStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [generalForm, setGeneralForm] = useState<GeneralFormState>({
    id_estado_civil: "",
    id_ocupacion: "",
    id_tipo_sangre: "",
    altura: "",
    peso: "",
    estilo_vida: "",
  });
  const [savingGeneral, setSavingGeneral] = useState(false);

  // D-ID Agents API Configuration
  const DID_API_KEY = import.meta.env.VITE_DID_API_KEY || "dmluaWNpby5jYW50dUB1ZGVtLmVkdQ:xSGXERmQ_Iv3I1X6Codcb";
  const DID_API_URL = import.meta.env.VITE_DID_API_URL || "https://api.d-id.com";
  const DID_API_SERVICE = import.meta.env.VITE_DID_API_SERVICE || "talks";
  const OPENAI_API_KEY_ENV = import.meta.env.VITE_OPENAI_API_KEY;
  // URL de la imagen del avatar (puede ser una URL pública o una imagen subida a D-ID)
  const AVATAR_IMAGE_URL = import.meta.env.VITE_DID_AVATAR_IMAGE_URL || "https://create-images-results.d-id.com/DefaultPresenters/Emma_f/v1_image.jpeg";

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionClientAnswerRef = useRef<RTCSessionDescriptionInit | null>(null);
  const agentIdRef = useRef<string>("");
  const chatIdRef = useRef<string>("");
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const partialResponseRef = useRef<string>("");
  const currentResponseRef = useRef<string>("");
  const statsIntervalIdRef = useRef<number | null>(null);
  const videoIsPlayingRef = useRef<boolean>(false);
  const lastBytesReceivedRef = useRef<number>(0);
  const iceCandidatesQueueRef = useRef<Array<{candidate: string; sdpMid: string | null; sdpMLineIndex: number | null}>>([]);
  const isProcessingIceCandidatesRef = useRef<boolean>(false);
  const streamAssignedRef = useRef<boolean>(false);
  const welcomeMessageSentRef = useRef<boolean>(false);
  const pacienteNombreRef = useRef<string>("");
  const [previewFile, setPreviewFile] = useState<Archivo | null>(null);


  const DEFAULT_API = import.meta.env.VITE_API || "http://localhost:8080";
  const AI_API = import.meta.env.VITE_AI_API || DEFAULT_API;
  const AUTH_API = import.meta.env.VITE_AUTH_API || DEFAULT_API;
  // El endpoint de conversaciones está en el backend principal (puerto 8080), no en ai_service
  const conversationEndpoint = useMemo(
    () => `${DEFAULT_API}/api/did/conversations`,
    [DEFAULT_API]
  );

  // Cargar datos desde la BD al montar el componente
  useEffect(() => {
    if (PATIENT_ID) {
      loadPatientData();
      // Cargar foto del paciente
      loadPatientPhoto();
    } else {
      toast.error("No hay paciente logueado. Redirigiendo al login...");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    }
  }, [PATIENT_ID]);

  // Función para cargar la foto del paciente
  const loadPatientPhoto = async () => {
    if (!PATIENT_ID) return;
    try {
      const response = await fetch(`${AUTH_API}/api/auth/patient/${PATIENT_ID}/photo`);
      if (response.ok) {
        const data = await response.json();
        if (data.photo_url) {
          setUserInfo(prev => ({ ...prev, foto_url: data.photo_url }));
        }
      }
    } catch (error) {
      console.error("Error cargando foto:", error);
    }
  };

  // Aplicar fondo oscuro al body cuando el componente está montado
  useEffect(() => {
    const originalBg = document.body.style.background;
    document.body.style.background = "linear-gradient(180deg, #0b1220, #0a1730)";
    return () => {
      document.body.style.background = originalBg;
    };
  }, []);

  useEffect(() => {
    if (isEditingGeneral) return;
    setGeneralForm({
      id_estado_civil: state.PACIENTE.id_estado_civil ? String(state.PACIENTE.id_estado_civil) : "",
      id_ocupacion: state.PACIENTE.id_ocupacion ? String(state.PACIENTE.id_ocupacion) : "",
      id_tipo_sangre: state.PACIENTE.id_tipo_sangre ? String(state.PACIENTE.id_tipo_sangre) : "",
      altura: state.PACIENTE.altura || "",
      peso: state.PACIENTE.peso || "",
      estilo_vida: state.PACIENTE.estilo_vida || "",
    });
  }, [
    isEditingGeneral,
    state.PACIENTE.id_estado_civil,
    state.PACIENTE.id_ocupacion,
    state.PACIENTE.id_tipo_sangre,
    state.PACIENTE.altura,
    state.PACIENTE.peso,
    state.PACIENTE.estilo_vida,
  ]);

  // Función para cargar todos los datos del paciente desde la BD
  const loadPatientData = async () => {
    setLoading(true);
    try {
      // Cargar datos del paciente
      const patientData = await api.patient.getPatient(PATIENT_ID);
      if (patientData) {
        setState(prev => ({
          ...prev,
          PACIENTE: {
            id: patientData.id || 0,
            usuario_id: patientData.usuario_id || 0,
            nombre: patientData.nombre || "",
            apellido: patientData.apellido || "",
            fecha_nacimiento: patientData.fecha_nacimiento || "",
            sexo: patientData.sexo || "",
            altura: patientData.altura?.toString() || "",
            peso: patientData.peso?.toString() || "",
            estilo_vida: patientData.estilo_vida || "",
            id_tipo_sangre: patientData.id_tipo_sangre || 0,
            id_ocupacion: patientData.id_ocupacion || 0,
            id_estado_civil: patientData.id_estado_civil || 0,
            id_medico_gen: patientData.id_medico_gen || 0,
            foto_archivo_id: patientData.foto_archivo_id || null,
          },
        }));
      }

      // Cargar catálogos
      const catalogos = await api.database.getCatalogos();
      if (catalogos) {
        setState(prev => ({
          ...prev,
          CATALOGOS: {
            ESTADO_CITA: catalogos.ESTADO_CITA || [],
            TIPO_CITA: catalogos.TIPO_CITA || [],
            ESTADO_CONSULTA: catalogos.ESTADO_CONSULTA || [],
            TIPO_SANGRE: catalogos.TIPO_SANGRE || [],
            OCUPACION: catalogos.OCUPACION || [],
            ESTADO_CIVIL: catalogos.ESTADO_CIVIL || [],
            MEDICO: catalogos.MEDICO || [],
          },
        }));
      }

      // Cargar consultas
      const consultations = await api.patient.getConsultations(PATIENT_ID);
      if (consultations && consultations.length > 0) {
        const latestConsultation = consultations[0]; // Usar la más reciente
        setState(prev => ({
          ...prev,
          CONSULTA: {
            id: latestConsultation.id || 0,
            cita_id: latestConsultation.cita_id || 0,
            id_estado_consulta: latestConsultation.id_estado_consulta || 0,
            id_episodio: latestConsultation.id_episodio || 0,
            fecha_hora: latestConsultation.fecha_hora || "",
            narrativa: latestConsultation.narrativa || "",
            mongo_consulta_id: latestConsultation.mongo_consulta_id || "",
            diagnostico_final: latestConsultation.diagnostico_final || "",
          },
        }));
      }

      // Cargar archivos
      const files = await api.patient.getFiles(PATIENT_ID);
      if (files) {
        setState(prev => ({
          ...prev,
          ARCHIVO: files.archivos || [],
          ARCHIVO_ASOCIACION: files.asociaciones || [],
          INTERPRETACION_ARCHIVO: files.interpretaciones || [],
        }));
      }

      // Actualizar información del usuario con datos del paciente
      if (patientData) {
        const nombreCompleto = `${patientData.nombre} ${patientData.apellido}`.trim();
        pacienteNombreRef.current = patientData.nombre || "";
        setUserInfo(prev => ({
          ...prev,
          paciente_nombre: nombreCompleto
        }));
      }

      toast.success("Datos cargados correctamente");
    } catch (error) {
      console.error("Error cargando datos del paciente:", error);
      toast.error("Error al cargar datos del paciente");
    } finally {
      setLoading(false);
    }
  };


  const patientId = state.PACIENTE.id || null;
  const consultaId = state.CONSULTA.id || null;
  const usuarioId = state.PACIENTE.usuario_id || null;

  // Datos calculados
  const nombreCompleto = `${state.PACIENTE.nombre} ${state.PACIENTE.apellido}`.trim() || "—";
  const edad = useMemo(() => {
    if (!state.PACIENTE.fecha_nacimiento) return "—";
    return calculateAge(state.PACIENTE.fecha_nacimiento);
  }, [state.PACIENTE.fecha_nacimiento]);
  const tipoSangre = state.CATALOGOS.TIPO_SANGRE.find(t => t.id === state.PACIENTE.id_tipo_sangre)?.nombre || "—";
  const ocupacion = state.CATALOGOS.OCUPACION.find(o => o.id === state.PACIENTE.id_ocupacion)?.nombre || "—";
  const estadoCivil = state.CATALOGOS.ESTADO_CIVIL.find(e => e.id === state.PACIENTE.id_estado_civil)?.nombre || "—";
  const medicoGen = state.CATALOGOS.MEDICO.find(m => m.id === state.PACIENTE.id_medico_gen)?.nombre || "—";

  // Condiciones médicas - vacías por ahora, se pueden cargar desde la BD si hay una tabla de condiciones
  const conditions = useMemo(() => {
    // Si hay códigos ICD10 en AI, los mostramos, pero sin datos hardcodeados
    return state.AI.suggestedICD10.map(code => ({
      code,
      name: code,
      status: "unknown",
      severity: "—"
    }));
  }, [state.AI.suggestedICD10]);

  // Archivos asociados al paciente
  const archivosPaciente = useMemo(() => {
    return state.ARCHIVO_ASOCIACION
      .filter(a => a.entidad === "PACIENTE" && a.entidad_id === state.PACIENTE.id)
      .map(a => {
        const archivo = state.ARCHIVO.find(ar => ar.id === a.archivo_id);
        const interpretacion = state.INTERPRETACION_ARCHIVO.find(i => i.id_archivo === a.archivo_id);
        return { ...a, archivo, interpretacion };
      });
  }, [state]);

  const persistConversationTurn = useCallback(async (payload: ConversationTurnPayload) => {
    if (!payload.text && !payload.audioUrl) {
      return;
    }
    try {
      await fetch(conversationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn("No se pudo guardar turno de conversación del avatar:", error);
    }
  }, [conversationEndpoint]);


  // Función para guardar mensajes en MongoDB
  const saveMessageToDB = useCallback(async (role: "user" | "assistant", content: string, audio: string | null = null) => {
    try {
      const userId = state.PACIENTE.usuario_id || null;
      const patientId = state.PACIENTE.id || null;
      
      if (!agentIdRef.current || !chatIdRef.current) {
        console.warn('⚠️ Cannot save message: agentId or chatId missing', {
          agentId: agentIdRef.current,
          chatId: chatIdRef.current
        });
        return;
      }

      if (!content || content.trim() === '') {
        console.warn('⚠️ Cannot save message: content is empty');
        return;
      }

      const payload = {
        role: role === "user" ? "user" : "agent",
        text: content.trim(),
        agentId: agentIdRef.current,
        chatId: chatIdRef.current,
        userId: userId,  // Enviar como userId (el backend acepta ambos)
        usuarioId: userId,  // También enviar como usuarioId para compatibilidad
        patientId: patientId,
        timestamp: new Date().toISOString()
      };

      if (audio) {
        payload.audioUrl = audio;
      }

      console.log('💾 Guardando mensaje en DB:', {
        role,
        agentId: agentIdRef.current,
        chatId: chatIdRef.current,
        userId,
        patientId,
        contentLength: content.length
      });

      // Usar DEFAULT_API (backend principal) en lugar de AI_API para conversaciones
      // Usar timeout corto para no bloquear la UI
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout (aumentado para no interrumpir mientras escribes)
      
      try {
        const response = await fetch(`${DEFAULT_API}/api/did/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let error;
          try {
            error = JSON.parse(errorText);
          } catch {
            error = { message: errorText };
          }
          console.warn('⚠️ Failed to save message to DB (no bloqueante):', {
            status: response.status,
            statusText: response.statusText,
            error
          });
        } else {
          const result = await response.json();
          console.log('✅ Message saved to DB:', result);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        // No mostrar error si es timeout o conexión rechazada - es no bloqueante
        if (fetchError.name === 'AbortError') {
          console.warn('⚠️ Timeout guardando mensaje (no bloqueante)');
        } else if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('ERR_CONNECTION_REFUSED')) {
          console.warn('⚠️ Backend no disponible para guardar mensaje (no bloqueante). El avatar seguirá funcionando.');
        } else {
          console.warn('⚠️ Error saving message to DB (no bloqueante):', fetchError);
        }
      }
    } catch (error) {
      // Error no bloqueante - el avatar debe seguir funcionando
      console.warn('⚠️ Error saving message to DB (no bloqueante):', error);
    }
  }, [DEFAULT_API, state.PACIENTE.usuario_id, state.PACIENTE.id]);

  // Crear agente D-ID con knowledge base
  const createDIDAgent = useCallback(async () => {
    try {
      // Verificar que la API key esté configurada
      if (!DID_API_KEY || DID_API_KEY === "dmluaWNpby5jYW50dUB1ZGVtLmVkdQ:xSGXERmQ_Iv3I1X6Codcb") {
        const errorMsg = "API Key de D-ID no configurada. Por favor, configura VITE_DID_API_KEY en frontend/.env";
        console.error(errorMsg);
        toast.error(errorMsg, { id: "agent-creation", duration: 5000 });
        setAvatarStatus("disconnected");
        throw new Error(errorMsg);
      }

      setAvatarStatus("connecting");
      toast.loading("Creando agente médico...", { id: "agent-creation" });

      // Construir instrucciones con contexto del paciente
      let patientContext = "";
      if (state.PACIENTE.id && (state.PACIENTE.nombre || state.PACIENTE.apellido)) {
        const nombreCompleto = `${state.PACIENTE.nombre} ${state.PACIENTE.apellido}`.trim();
        patientContext = `\n\nCONTEXTO DEL PACIENTE ACTUAL:\n- Nombre: ${nombreCompleto || 'No disponible'}\n- ID: ${state.PACIENTE.id}`;
        if (state.PACIENTE.fecha_nacimiento) {
          patientContext += `\n- Fecha de nacimiento: ${state.PACIENTE.fecha_nacimiento}`;
        }
        if (state.PACIENTE.sexo) {
          patientContext += `\n- Sexo: ${state.PACIENTE.sexo}`;
        }
        patientContext += `\n\nIMPORTANTE: Usa este contexto para personalizar tus respuestas y dar seguimiento a consultas anteriores.`;
      }

      const instructions = `Eres un asistente médico virtual profesional. IMPORTANTE: DEBES HABLAR ÚNICAMENTE EN ESPAÑOL. NUNCA respondas en inglés u otro idioma.

INSTRUCCIONES CRÍTICAS:
- SIEMPRE responde en español (español de México)
- NUNCA uses inglés, incluso si el usuario te escribe en inglés, responde en español
- Sé amable, empático y profesional
- Proporciona información médica general pero siempre recomienda consultar con un médico real para diagnósticos
- Si te preguntan algo fuera del contexto médico, amablemente redirige la conversación
- Usa un tono cordial y cercano pero profesional
- Todas tus respuestas deben estar completamente en español
- PREGUNTA HASTA QUE LLEGUES A UN DIAGNOSTICO, NO ESPECULES
- NO MUESTRES LA INFORMACIÓN DEL PACIENTE A MENOS QUE SE TE PIDA EXPLÍCITAMENTE
- Usa el historial de conversaciones previas para dar seguimiento a consultas anteriores y mantener continuidad${patientContext}`;

      // 1. Crear knowledge base (opcional, podemos omitirlo si falla)
      let knowledgeId = null;
      try {
        const knowledgeRes = await fetch(`${DID_API_URL}/knowledge`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${DID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: "MedicalKnowledge",
            description: "Conocimiento médico general para asistente virtual"
          })
        });
        
        if (!knowledgeRes.ok) {
          const errorText = await knowledgeRes.text();
          console.warn("No se pudo crear knowledge base, continuando sin ella:", errorText);
        } else {
          const knowledgeData = await knowledgeRes.json();
          knowledgeId = knowledgeData.id;
        }
      } catch (e) {
        console.warn("Error creando knowledge base, continuando sin ella:", e);
      }

      // 2. Crear agente
      // Obtener OpenAI API key del backend (si está disponible) para provider custom
      const OPENAI_API_KEY_ENV = import.meta.env.VITE_OPENAI_API_KEY;
      
      const agentBody: any = {
        presenter: {
          type: "talk",
          voice: {
            type: "microsoft",
            voice_id: "es-MX-DaliaNeural"
          },
          thumbnail: AVATAR_IMAGE_URL,
          source_url: AVATAR_IMAGE_URL
        },
        llm: OPENAI_API_KEY_ENV ? {
          // Si tenemos OpenAI API key, usar provider custom con configuración
          type: "openai",
          provider: "custom",
          model: "gpt-4o-mini",
          instructions: instructions,
          template: "rag-ungrounded",
          config: {
            api_key: OPENAI_API_KEY_ENV,
            base_url: "https://api.openai.com/v1"
          }
        } : {
          // Si no tenemos OpenAI API key, usar modelo nativo de D-ID sin provider custom
          // Nota: D-ID puede tener modelos nativos, pero si requiere custom, necesitamos la API key
          type: "openai",
          model: "gpt-4o-mini",
          instructions: instructions,
          template: "rag-ungrounded"
        },
        preview_name: "Asistente Médico"
      };

      // Agregar knowledge solo si se creó exitosamente
      if (knowledgeId) {
        agentBody.knowledge = {
          provider: "pinecone",
          embedder: {
            provider: "azure-open-ai",
            model: "text-large-003"
          },
          id: knowledgeId
        };
      }

      const agentRes = await fetch(`${DID_API_URL}/agents`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${DID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentBody)
      });

      if (!agentRes.ok) {
        const errorText = await agentRes.text();
        throw new Error(`Error de D-ID API: ${agentRes.status} - ${errorText}`);
      }

      const agentData = await agentRes.json();
      agentIdRef.current = agentData.id;

      // 3. Crear chat
      const chatRes = await fetch(`${DID_API_URL}/agents/${agentIdRef.current}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${DID_API_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      if (!chatRes.ok) {
        const errorText = await chatRes.text();
        throw new Error(`Error creando chat: ${chatRes.status} - ${errorText}`);
      }

      const chatData = await chatRes.json();
      chatIdRef.current = chatData.id;

      toast.success("Agente creado exitosamente", { id: "agent-creation" });
      return { agentId: agentIdRef.current, chatId: chatIdRef.current };
    } catch (error: any) {
      console.error("Error creando agente:", error);
      const errorMessage = error.message || "Error desconocido. Verifica tu API key de D-ID en frontend/.env";
      toast.error(`Error creando agente: ${errorMessage}`, { id: "agent-creation", duration: 5000 });
      setAvatarStatus("disconnected");
      throw error;
    }
  }, [DID_API_KEY, DID_API_URL, state.PACIENTE]);

  // Conectar a D-ID stream
  const connectDIDStream = useCallback(async () => {
    try {
      // Verificar API key
      if (!DID_API_KEY || DID_API_KEY === "dmluaWNpby5jYW50dUB1ZGVtLmVkdQ:xSGXERmQ_Iv3I1X6Codcb") {
        const errorMsg = "API Key de D-ID no configurada. Configura VITE_DID_API_KEY en frontend/.env y reinicia el frontend";
        console.error(errorMsg);
        toast.error(errorMsg, { id: "connection", duration: 5000 });
        setAvatarStatus("disconnected");
        throw new Error(errorMsg);
      }

      if (!agentIdRef.current || !chatIdRef.current) {
        await createDIDAgent();
      }

      setAvatarStatus("connecting");
      toast.loading("Conectando con el avatar...", { id: "connection" });

      // Crear stream
      const streamRes = await fetch(`${DID_API_URL}/${DID_API_SERVICE}/streams`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${DID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url: AVATAR_IMAGE_URL
        })
      });

      if (!streamRes.ok) {
        const errorText = await streamRes.text();
        throw new Error(`Error creando stream: ${streamRes.status} - ${errorText}`);
      }

      const streamData = await streamRes.json();
      streamIdRef.current = streamData.id;
      sessionIdRef.current = streamData.session_id;

      // Crear peer connection
      const pc = new RTCPeerConnection({ iceServers: streamData.ice_servers || [{ urls: ["stun:stun.l.google.com:19302"] }] });
      pcRef.current = pc;

      // Event listeners
      pc.addEventListener('icegatheringstatechange', () => {
        console.log('ICE gathering state:', pc.iceGatheringState);
      });

      pc.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          iceCandidatesQueueRef.current.push({
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          });
          processIceCandidatesQueue();
        }
      });

      pc.addEventListener('iceconnectionstatechange', async () => {
        const state = pc.iceConnectionState;
        console.log('ICE connection state:', state);
        
        if (state === 'connected' || state === 'completed') {
          setAvatarStatus("connected");
          if (state === 'connected') {
            toast.success("Conectado exitosamente", { id: "connection" });
          }
          
          // Si el data channel ya está abierto, intentar enviar mensaje de bienvenida
          if (dataChannelRef.current && dataChannelRef.current.readyState === 'open' && !welcomeMessageSentRef.current) {
            setTimeout(async () => {
              try {
                if (!welcomeMessageSentRef.current && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                // Obtener mensaje de bienvenida personalizado del backend
                let welcomeMessage = "Hola, ¿en qué puedo ayudarte hoy?";
                try {
                  const patientId = state.PACIENTE.id;
                  const userId = state.PACIENTE.usuario_id;
                  if (patientId || userId) {
                    const welcomeRes = await fetch(`${DEFAULT_API}/api/ai/patient/welcome`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ patientId, userId })
                    });
                    if (welcomeRes.ok) {
                      const welcomeData = await welcomeRes.json();
                      if (welcomeData.message) {
                        welcomeMessage = welcomeData.message;
                      }
                    }
                  }
                } catch (error) {
                  console.warn("⚠️ Error obteniendo mensaje de bienvenida, usando mensaje por defecto:", error);
                  // Usar mensaje por defecto con nombre si está disponible
                  const nombrePaciente = pacienteNombreRef.current;
                  if (nombrePaciente && nombrePaciente.trim()) {
                    welcomeMessage = `Hola ${nombrePaciente.trim()}, ¿en qué puedo ayudarte hoy?`;
                  }
                }
                  console.log("🚀 Enviando mensaje de bienvenida (ICE connected + data channel open):", welcomeMessage);
                  welcomeMessageSentRef.current = true;
                  
                  // Enviar mensaje a través del data channel
                  const encodedMessage = `chat/text:${encodeURIComponent(welcomeMessage)}`;
                  console.log("📤 Enviando por data channel:", encodedMessage);
                  dataChannelRef.current.send(encodedMessage);
                  
                  // También enviar a través de la API REST como respaldo
                  try {
                    await sendMessageToAvatar(welcomeMessage);
                    console.log("✅ Mensaje enviado por API REST");
                  } catch (apiError) {
                    console.warn("⚠️ Error enviando mensaje por API (no crítico):", apiError);
                  }
                  
                  // Guardar mensaje del usuario en la DB
                  try {
                    await saveMessageToDB("user", welcomeMessage);
                    console.log("✅ Mensaje guardado en DB");
                  } catch (dbError) {
                    console.warn("⚠️ Error guardando en DB (no crítico):", dbError);
                  }
                  
                  // Mostrar mensaje en el chat
                  const msgHistory = document.getElementById("msgHistory");
                  if (msgHistory) {
                    msgHistory.innerHTML += `<p class="user-message">${welcomeMessage}</p>`;
                    msgHistory.scrollTop = msgHistory.scrollHeight;
                  }
                }
              } catch (error) {
                console.warn("Error enviando mensaje de bienvenida (no crítico):", error);
                welcomeMessageSentRef.current = false; // Permitir reintento
              }
            }, 200);
          }
        } else if (state === 'disconnected') {
          // Estado 'disconnected' es temporal, no desconectar aún
          console.warn('⚠️ ICE connection disconnected (temporal, esperando reconexión...)');
          // No cambiar el estado aquí, esperar a ver si se reconecta
        } else if (state === 'failed') {
          console.error('❌ ICE connection failed');
          setAvatarStatus("disconnected");
          toast.error("Conexión fallida. Intenta reconectar.", { id: "connection" });
          destroyConnection();
        } else if (state === 'closed') {
          console.log('ℹ️ ICE connection closed');
          setAvatarStatus("disconnected");
        }
      });

      pc.addEventListener('track', (event) => {
        console.log('Track recibido:', event.track.kind, 'Stream ID:', event.streams[0]?.id);
        
        // Solo procesar tracks de video, o el primer stream que llegue
        if (event.track.kind === 'video' && videoRef.current && event.streams[0] && !streamAssignedRef.current) {
          console.log('Asignando stream de video:', event.streams[0]);
          streamAssignedRef.current = true;
          
          // Detener cualquier stream anterior
          if (videoRef.current.srcObject) {
            const oldStream = videoRef.current.srcObject as MediaStream;
            oldStream.getTracks().forEach(track => {
              track.stop();
              console.log('Track anterior detenido:', track.kind);
            });
          }
          
          // Asignar nuevo stream
          videoRef.current.srcObject = event.streams[0];
          console.log('Stream asignado, tracks:', event.streams[0].getTracks().map(t => t.kind));
          
          // Marcar como conectado inmediatamente
          setAvatarStatus("connected");
          
          // El mensaje de bienvenida se enviará cuando el data channel se abra
          // para asegurar que esté completamente listo
          
          // El video debería reproducirse automáticamente con autoplay
          // Pero intentamos play() por si acaso después de un breve delay
          setTimeout(() => {
            if (videoRef.current) {
              if (videoRef.current.paused) {
                videoRef.current.play()
                  .then(() => {
                    console.log('✅ Video reproduciendo correctamente');
                  })
                  .catch((error) => {
                    console.warn('⚠️ Error en play() (normal con múltiples tracks):', error.name);
                    // El video puede reproducirse automáticamente de todas formas
                  });
              } else {
                console.log('✅ Video ya está reproduciendo');
              }
              
              // Verificar que el video tenga contenido
              console.log('Video info:', {
                srcObject: !!videoRef.current.srcObject,
                paused: videoRef.current.paused,
                readyState: videoRef.current.readyState,
                videoWidth: videoRef.current.videoWidth,
                videoHeight: videoRef.current.videoHeight
              });
            }
          }, 200);
        } else if (event.track.kind === 'audio') {
          console.log('Track de audio recibido (se agregará al mismo stream)');
          // El audio se agregará automáticamente al mismo stream
          if (!streamAssignedRef.current) {
            // Si aún no hay video, esperar un poco
            setTimeout(() => {
              if (videoRef.current && videoRef.current.srcObject) {
                streamAssignedRef.current = true;
                setAvatarStatus("connected");
              }
            }, 500);
          }
        } else if (streamAssignedRef.current) {
          console.log('Stream ya asignado, track adicional:', event.track.kind);
        }
      });

      // Set remote description
      await pc.setRemoteDescription(streamData.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sessionClientAnswerRef.current = answer;

      // Enviar SDP answer
      await fetch(`${DID_API_URL}/${DID_API_SERVICE}/streams/${streamIdRef.current}/sdp`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${DID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer: answer,
          session_id: sessionIdRef.current
        })
      });

      // Crear data channel
      const dc = pc.createDataChannel("JanusDataChannel");
      dataChannelRef.current = dc;

      dc.onopen = async () => {
        console.log("Data channel abierto");
        setAvatarStatus("connected");
        
        // Enviar mensaje de bienvenida INMEDIATAMENTE cuando el data channel se abre
        // Esto activa el avatar tan pronto como la conexión esté lista
        if (!welcomeMessageSentRef.current) {
          setTimeout(async () => {
            try {
              if (!welcomeMessageSentRef.current && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                // Obtener mensaje de bienvenida personalizado del backend
                let welcomeMessage = "Hola, ¿en qué puedo ayudarte hoy?";
                try {
                  const patientId = state.PACIENTE.id;
                  const userId = state.PACIENTE.usuario_id;
                  if (patientId || userId) {
                    const welcomeRes = await fetch(`${DEFAULT_API}/api/ai/patient/welcome`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ patientId, userId })
                    });
                    if (welcomeRes.ok) {
                      const welcomeData = await welcomeRes.json();
                      if (welcomeData.message) {
                        welcomeMessage = welcomeData.message;
                      }
                    }
                  }
                } catch (error) {
                  console.warn("⚠️ Error obteniendo mensaje de bienvenida, usando mensaje por defecto:", error);
                  // Usar mensaje por defecto con nombre si está disponible
                const nombrePaciente = pacienteNombreRef.current;
                  if (nombrePaciente && nombrePaciente.trim()) {
                    welcomeMessage = `Hola ${nombrePaciente.trim()}, ¿en qué puedo ayudarte hoy?`;
                  }
                }
                console.log("🚀 Enviando mensaje de bienvenida automático (data channel abierto):", welcomeMessage);
                welcomeMessageSentRef.current = true;
                
                // Enviar mensaje a través del data channel
                const encodedMessage = `chat/text:${encodeURIComponent(welcomeMessage)}`;
                console.log("📤 Enviando por data channel:", encodedMessage);
                dataChannelRef.current.send(encodedMessage);
                
                // También enviar a través de la API REST como respaldo
                try {
                  await sendMessageToAvatar(welcomeMessage);
                  console.log("✅ Mensaje enviado por API REST");
                } catch (apiError) {
                  console.warn("⚠️ Error enviando mensaje por API (no crítico):", apiError);
                }
                
                // Guardar mensaje del usuario en la DB
                try {
                  await saveMessageToDB("user", welcomeMessage);
                  console.log("✅ Mensaje guardado en DB");
                } catch (dbError) {
                  console.warn("⚠️ Error guardando en DB (no crítico):", dbError);
                }
                
                // Mostrar mensaje en el chat
                const msgHistory = document.getElementById("msgHistory");
                if (msgHistory) {
                  msgHistory.innerHTML += `<p class="user-message">${welcomeMessage}</p>`;
                  msgHistory.scrollTop = msgHistory.scrollHeight;
                }
              }
            } catch (error) {
              console.warn("Error enviando mensaje de bienvenida (no crítico):", error);
              welcomeMessageSentRef.current = false; // Permitir reintento
            }
          }, 100); // Muy corto delay para enviar inmediatamente
        }
      };

      dc.onclose = () => {
        console.log("⚠️ Data channel cerrado");
        // No desconectar inmediatamente, puede ser temporal
        // Solo cambiar estado si realmente está cerrado
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'closed') {
          console.log("Data channel realmente cerrado, desconectando...");
          setAvatarStatus("disconnected");
        }
      };
      
      dc.onerror = (error) => {
        console.error("❌ Error en data channel:", error);
        // No desconectar por errores menores, solo loguear
      };

      dc.onmessage = async (event) => {
        const msg = event.data;
        if (msg.includes("chat/partial:")) {
          const partial = decodeURIComponent(msg.replace("chat/partial:", ""));
          partialResponseRef.current += partial;
        } else if (msg.includes("stream/done")) {
          if (partialResponseRef.current) {
            const avatarMessage: ChatMessage = {
              sender: "avatar",
              text: partialResponseRef.current,
              timestamp: new Date(),
            };
            setChatMessages((prev) => [...prev, avatarMessage]);
            await saveMessageToDB("assistant", partialResponseRef.current);
            currentResponseRef.current = partialResponseRef.current;
            partialResponseRef.current = '';
          }
        }
      };

    } catch (error: any) {
      console.error("Error conectando stream:", error);
      const errorMessage = error.message || "Error desconocido. Verifica tu API key de D-ID";
      toast.error(`Error conectando: ${errorMessage}`, { id: "connection", duration: 5000 });
      setAvatarStatus("disconnected");
    }
  }, [DID_API_KEY, DID_API_URL, DID_API_SERVICE, createDIDAgent, saveMessageToDB]);

  // Procesar cola de ICE candidates
  const processIceCandidatesQueue = useCallback(async () => {
    if (isProcessingIceCandidatesRef.current || iceCandidatesQueueRef.current.length === 0 || !streamIdRef.current) return;
    
    isProcessingIceCandidatesRef.current = true;
    
    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      if (!candidate) break;
      
      try {
        await fetch(`${DID_API_URL}/${DID_API_SERVICE}/streams/${streamIdRef.current}/ice`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${DID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...candidate,
            session_id: sessionIdRef.current,
          }),
        });
      } catch (error) {
        console.error('Error enviando ICE candidate:', error);
        iceCandidatesQueueRef.current.unshift(candidate);
        break;
      }
    }
    
    isProcessingIceCandidatesRef.current = false;
  }, [DID_API_KEY, DID_API_URL, DID_API_SERVICE]);

  // Destruir conexión
  const destroyConnection = useCallback(async () => {
    try {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (statsIntervalIdRef.current) {
        clearInterval(statsIntervalIdRef.current);
        statsIntervalIdRef.current = null;
      }
      if (streamIdRef.current && sessionIdRef.current) {
        await fetch(`${DID_API_URL}/${DID_API_SERVICE}/streams/${streamIdRef.current}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${DID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: sessionIdRef.current }),
        });
      }
      streamIdRef.current = null;
      sessionIdRef.current = null;
      sessionClientAnswerRef.current = null;
      partialResponseRef.current = '';
      currentResponseRef.current = '';
      iceCandidatesQueueRef.current = [];
      streamAssignedRef.current = false;
      welcomeMessageSentRef.current = false; // Reset para permitir nuevo mensaje de bienvenida
      setAvatarStatus("disconnected");
    } catch (error) {
      console.error("Error destruyendo conexión:", error);
    }
  }, [DID_API_KEY, DID_API_URL, DID_API_SERVICE]);

  // Iniciar avatar (crear agente y conectar)
  const startAvatar = useCallback(async () => {
    try {
      await connectDIDStream();
    } catch (error: any) {
      console.error("Error iniciando avatar:", error);
      toast.error("Error al iniciar el avatar médico");
      setAvatarStatus("disconnected");
    }
  }, [connectDIDStream]);

  // Detener avatar
  const stopAvatar = useCallback(() => {
    destroyConnection();
  }, [destroyConnection]);

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || isSpeaking || avatarStatus !== "connected" || !agentIdRef.current || !chatIdRef.current || !streamIdRef.current) {
      return;
    }

    const userMessage: ChatMessage = {
      sender: "user",
      text: chatInput.trim(),
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    await saveMessageToDB("user", userMessage.text);
    const messageText = chatInput.trim();
    setChatInput("");

    setIsSpeaking(true);
    try {
      // Enviar mensaje a D-ID Agents API
      const res = await fetch(`${DID_API_URL}/agents/${agentIdRef.current}/chat/${chatIdRef.current}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${DID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId: streamIdRef.current,
          sessionId: sessionIdRef.current,
          messages: [{
            role: "user",
            content: messageText,
            created_at: new Date().toISOString()
          }]
        })
      });

      const data = await res.json();
      
      // Si está en modo texto solamente (sin créditos)
      if (res.status === 200 && data.chatMode === 'TextOnly') {
        const avatarMessage: ChatMessage = {
          sender: "avatar",
          text: data.result || "He recibido tu mensaje.",
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, avatarMessage]);
        await saveMessageToDB("assistant", avatarMessage.text);
      }
      // Si está en modo streaming, la respuesta vendrá por el data channel
      
    } catch (err: any) {
      console.error("Error enviando mensaje:", err);
      toast.error(`Error al enviar mensaje: ${err.message}`);
    } finally {
      setIsSpeaking(false);
    }
  }, [chatInput, isSpeaking, avatarStatus, saveMessageToDB, DID_API_KEY, DID_API_URL]);

  const toggleRecording = async () => {
    if (isSpeaking || avatarStatus !== "connected") return;

    if (isListening) {
      setIsListening(false);
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        await processAudio(blob);
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Error accediendo al micrófono:", err);
      toast.error("Error al acceder al micrófono");
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      setIsSpeaking(true);
      const formData = new FormData();
      formData.append("file", blob, "voz_usuario.wav");

      const sttRes = await fetch(`${AI_API}/api/ai/speech-to-text`, {
        method: "POST",
        body: formData,
      });

      if (!sttRes.ok) throw new Error(`Error STT: ${sttRes.status}`);
      const sttData = await sttRes.json();

      const userMessage: ChatMessage = {
        sender: "user",
        text: sttData.text || "(audio no reconocido)",
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, userMessage]);

      await sendMessageToAvatar(sttData.text);
    } catch (err) {
      console.error("Error procesando audio:", err);
      toast.error("Error al procesar audio");
    } finally {
      setIsSpeaking(false);
      setIsListening(false);
    }
  };

  // Función para enviar mensaje al avatar con contexto en español
  const sendMessageToAvatar = useCallback(async (message: string) => {
    if (!agentIdRef.current || !chatIdRef.current || !streamIdRef.current) {
      return;
    }

    try {
      const res = await fetch(`${DID_API_URL}/agents/${agentIdRef.current}/chat/${chatIdRef.current}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${DID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId: streamIdRef.current,
          sessionId: sessionIdRef.current,
          messages: [{
            role: "user",
            content: message,
            created_at: new Date().toISOString()
          }]
        })
      });

      const data = await res.json();
      
      // Si está en modo texto solamente
      if (res.status === 200 && data.chatMode === 'TextOnly') {
        const avatarMessage: ChatMessage = {
          sender: "avatar",
          text: data.result || "He recibido tu mensaje.",
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, avatarMessage]);
        await saveMessageToDB("assistant", avatarMessage.text);
      }
      // Si está en modo streaming, la respuesta vendrá por el data channel
      
    } catch (err: any) {
      console.error("Error enviando mensaje al avatar:", err);
      toast.error(`Error: ${err.message}`);
    }
  }, [saveMessageToDB, DID_API_KEY, DID_API_URL]);

  const syncGeneralFormFromState = () => {
    setGeneralForm({
      id_estado_civil: state.PACIENTE.id_estado_civil ? String(state.PACIENTE.id_estado_civil) : "",
      id_ocupacion: state.PACIENTE.id_ocupacion ? String(state.PACIENTE.id_ocupacion) : "",
      id_tipo_sangre: state.PACIENTE.id_tipo_sangre ? String(state.PACIENTE.id_tipo_sangre) : "",
      altura: state.PACIENTE.altura || "",
      peso: state.PACIENTE.peso || "",
      estilo_vida: state.PACIENTE.estilo_vida || "",
    });
  };

  const handleStartEditGeneral = () => {
    syncGeneralFormFromState();
    setIsEditingGeneral(true);
  };

  const handleCancelGeneralEdit = () => {
    syncGeneralFormFromState();
    setIsEditingGeneral(false);
  };

  const handleGeneralFieldChange = (field: keyof GeneralFormState, value: string) => {
    setGeneralForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveGeneral = async () => {
    if (!PATIENT_ID) {
      toast.error("No hay paciente seleccionado");
      return;
    }

    const toOptional = (value: string) => {
      const trimmed = value.trim();
      return trimmed !== "" ? trimmed : null;
    };

    const payload = {
      nombre: state.PACIENTE.nombre,
      apellido: state.PACIENTE.apellido,
      fecha_nacimiento: state.PACIENTE.fecha_nacimiento,
      sexo: state.PACIENTE.sexo,
      altura: toOptional(generalForm.altura),
      peso: toOptional(generalForm.peso),
      estilo_vida: toOptional(generalForm.estilo_vida),
      id_tipo_sangre: generalForm.id_tipo_sangre ? Number(generalForm.id_tipo_sangre) : null,
      id_ocupacion: generalForm.id_ocupacion ? Number(generalForm.id_ocupacion) : null,
      id_estado_civil: generalForm.id_estado_civil ? Number(generalForm.id_estado_civil) : null,
      id_medico_gen: state.PACIENTE.id_medico_gen || null,
    };

    setSavingGeneral(true);
    try {
      const result = await api.patient.updatePatient(PATIENT_ID, payload);
      if (!result || result.success === false) {
        throw new Error(result?.error || "No se pudo actualizar la información");
      }

      setState((prev) => ({
        ...prev,
        PACIENTE: {
          ...prev.PACIENTE,
          id_tipo_sangre: payload.id_tipo_sangre ?? 0,
          id_ocupacion: payload.id_ocupacion ?? 0,
          id_estado_civil: payload.id_estado_civil ?? 0,
          altura: payload.altura ? String(payload.altura) : "",
          peso: payload.peso ? String(payload.peso) : "",
          estilo_vida: payload.estilo_vida ?? "",
        },
      }));
      toast.success("Información actualizada");
      setIsEditingGeneral(false);
    } catch (error: any) {
      console.error("Error actualizando info del paciente:", error);
      toast.error(error?.message || "Error al actualizar la información");
    } finally {
      setSavingGeneral(false);
    }
  };

  if (loading) {
    return (
      <div className="patient-view" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(180deg, #0b1220, #0a1730)' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Cargando datos del paciente...</div>
          <div style={{ fontSize: '14px', color: '#aaa', marginTop: '8px' }}>Por favor espera</div>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-view">
      <div className="patient-view__container">
        {/* Panel Izquierdo - Información del Paciente */}
        <div className="patient-view__left">
          <div className="patient-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              {userInfo?.foto_url && (
                <img 
                  src={userInfo.foto_url} 
                  alt={nombreCompleto}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                  }}
                />
              )}
              <div>
                <h1 className="patient-header__title">{nombreCompleto}</h1>
                {userInfo?.paciente_nombre && (
                  <p style={{ color: '#aaa', fontSize: '14px', margin: '4px 0 0 0' }}>
                    {userInfo.paciente_nombre}
                  </p>
                )}
              </div>
            </div>
            <div className="patient-header__tabs">
              <button 
                className={`patient-header__tab ${activeTab === "paciente" ? "patient-header__tab--active" : ""}`}
                onClick={() => setActiveTab("paciente")}
              >
                Paciente
              </button>
              <button 
                className={`patient-header__tab ${activeTab === "partes" ? "patient-header__tab--active" : ""}`}
                onClick={() => setActiveTab("partes")}
              >
                Partes
              </button>
            </div>
          </div>

          {activeTab === "paciente" && (
            <div className="patient-section">
              <div className="patient-section__header">
                <span className="patient-section__toggle">▼ Paciente</span>
              </div>

            <div className="patient-info">
              <div className="patient-info__main">
                <div className="patient-info__details">
                  <span>Género: {state.PACIENTE.sexo === "Female" ? "Femenino" : state.PACIENTE.sexo === "Male" ? "Masculino" : state.PACIENTE.sexo}</span>
                  <span>Edad: {edad}</span>
                  <span>Tipo de Sangre: {tipoSangre}</span>
                  <span>Altura: {state.PACIENTE.altura} cm | Peso: {state.PACIENTE.peso} kg</span>
                </div>
              </div>
            </div>

              {/* Información Crítica */}
              <div className="critical-info">
                <h3 className="critical-info__title">Información Crítica</h3>
                <div className="critical-info__content">
                  <div className="critical-info__left">
                    {conditions.slice(0, 2).map((condition, idx) => (
                      <div key={idx} className="critical-item">
                        <span className="critical-item__code">{condition.code}:</span>
                        <span className="critical-item__text">{condition.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="critical-info__right">
                    <div className="critical-diagnosis">
                      {conditions.map((c) => `${c.code} ${c.name}`).join("; ")}
                    </div>
                    <div className="critical-allergies">
                      <strong>Alergias:</strong> Reacciones alérgicas severas a β-lactámicos.
                    </div>
                  </div>
                </div>
              </div>

              {/* Condiciones */}
              <div className="conditions-section">
                <div className="conditions-section__header">
                  <h3>Condiciones</h3>
                  <div className="conditions-section__controls">
                    <span className="conditions-section__page">(1/{Math.ceil(conditions.length / 5)})</span>
                  </div>
                </div>
                <table className="conditions-table">
                  <thead>
                    <tr>
                      <th>Condición</th>
                      <th>Estado</th>
                      <th>Severidad</th>
                      <th>Fecha de Diagnóstico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conditions.map((condition, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{condition.code}:</strong> {condition.name}
                        </td>
                        <td className={`condition-status condition-status--${condition.status}`}>
                          {condition.status === "chronic" ? "crónico" : 
                           condition.status === "acute" ? "agudo" : 
                           condition.status === "unchanged" ? "sin cambios" : 
                           condition.status === "resolved" ? "resuelto" : condition.status}
                        </td>
                        <td>{condition.severity}</td>
                        <td>{condition.diagnosisDate ? fmtDate(condition.diagnosisDate) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Información General */}
              <div className="general-info">
                <div
                  className="general-info__header"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}
                >
                  <h3>Información General</h3>
                  {isEditingGeneral ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => void handleSaveGeneral()}
                        disabled={savingGeneral}
                        style={{
                          background: "#52e5ff",
                          border: "none",
                          color: "#0b1220",
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: savingGeneral ? "not-allowed" : "pointer",
                          opacity: savingGeneral ? 0.6 : 1,
                        }}
                      >
                        {savingGeneral ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelGeneralEdit}
                        disabled={savingGeneral}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.2)",
                          color: "#cfd8ff",
                          padding: "6px 14px",
                          borderRadius: 8,
                          cursor: savingGeneral ? "not-allowed" : "pointer",
                          opacity: savingGeneral ? 0.6 : 1,
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartEditGeneral}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.2)",
                        color: "#cfd8ff",
                        padding: "6px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                  )}
                </div>
                <div className="general-info__grid">
                  <div className="info-item">
                    <label>Estado Civil</label>
                    {isEditingGeneral ? (
                      <select
                        value={generalForm.id_estado_civil}
                        onChange={(event) => handleGeneralFieldChange("id_estado_civil", event.target.value)}
                        disabled={savingGeneral}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          color: "var(--txt)",
                          padding: "6px 10px",
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        {state.CATALOGOS.ESTADO_CIVIL.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{estadoCivil}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Ocupación</label>
                    {isEditingGeneral ? (
                      <select
                        value={generalForm.id_ocupacion}
                        onChange={(event) => handleGeneralFieldChange("id_ocupacion", event.target.value)}
                        disabled={savingGeneral}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          color: "var(--txt)",
                          padding: "6px 10px",
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        {state.CATALOGOS.OCUPACION.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{ocupacion}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Tipo de Sangre</label>
                    {isEditingGeneral ? (
                      <select
                        value={generalForm.id_tipo_sangre}
                        onChange={(event) => handleGeneralFieldChange("id_tipo_sangre", event.target.value)}
                        disabled={savingGeneral}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          color: "var(--txt)",
                          padding: "6px 10px",
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        {state.CATALOGOS.TIPO_SANGRE.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{tipoSangre}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Altura</label>
                    {isEditingGeneral ? (
                      <input
                        type="number"
                        step="0.01"
                        value={generalForm.altura}
                        onChange={(event) => handleGeneralFieldChange("altura", event.target.value)}
                        disabled={savingGeneral}
                        placeholder="Ej. 175"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          color: "var(--txt)",
                          padding: "6px 10px",
                        }}
                      />
                    ) : (
                      <span>{state.PACIENTE.altura ? `${state.PACIENTE.altura} cm` : "—"}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Peso</label>
                    {isEditingGeneral ? (
                      <input
                        type="number"
                        step="0.01"
                        value={generalForm.peso}
                        onChange={(event) => handleGeneralFieldChange("peso", event.target.value)}
                        disabled={savingGeneral}
                        placeholder="Ej. 78.5"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          color: "var(--txt)",
                          padding: "6px 10px",
                        }}
                      />
                    ) : (
                      <span>{state.PACIENTE.peso ? `${state.PACIENTE.peso} kg` : "—"}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Estilo de Vida</label>
                    {isEditingGeneral ? (
                      <input
                        type="text"
                        value={generalForm.estilo_vida}
                        onChange={(event) => handleGeneralFieldChange("estilo_vida", event.target.value)}
                        disabled={savingGeneral}
                        placeholder="Ej. Activo"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          color: "var(--txt)",
                          padding: "6px 10px",
                        }}
                      />
                    ) : (
                      <span>{state.PACIENTE.estilo_vida || "—"}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Médico General</label>
                    <span>{medicoGen}</span>
                  </div>
                  <div className="info-item">
                    <label>Familia</label>
                    <span>Zenon-Betz</span>
                  </div>
                  <div className="info-item">
                    <label>Seguro</label>
                    <span>Insurator: 938291</span>
                  </div>
                </div>
              </div>

              {/* Pre-diagnóstico IA */}
              <div className="pre-diagnosis">
                <h3>Pre-diagnóstico (IA)</h3>
                <p className="pre-diagnosis__text">{state.AI.preDiagnosis}</p>
              </div>
            </div>
          )}

          {activeTab === "partes" && (
            <div className="parts-section">
              <div className="parts-section__header">
                <span className="parts-section__toggle">▼ Partes</span>
              </div>

              {/* Archivos del Paciente */}
              <div className="files-section">
                <h3>Archivos Médicos</h3>
                {archivosPaciente.length === 0 ? (
                  <p className="no-files">No hay archivos asociados</p>
                ) : (
                  <div className="files-list">
                    {archivosPaciente.map((item) => (
                     <div
                     key={item.id}
                     className="file-item"
                     onClick={() => setPreviewFile(item.archivo || null)}
                     style={{ cursor: "pointer" }}
                   >
                   
                        <div className="file-item__header">
                          <div className="file-item__icon">
                            {item.archivo?.tipo.startsWith("image/") ? "🖼️" : "📄"}
                          </div>
                          <div className="file-item__info">
                            <div className="file-item__name">{item.descripcion}</div>
                            <div className="file-item__meta">
                              <span>Tipo: {item.archivo?.tipo || "—"}</span>
                              <span>Fecha: {fmtDate(item.fecha_creacion)}</span>
                            </div>
                          </div>
                        </div>
                        {item.interpretacion && (
                          <div className="file-item__interpretation">
                            <strong>Interpretación ({item.interpretacion.fuente}):</strong> {item.interpretacion.resultado}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Archivos de Consulta */}
              <div className="files-section" style={{ marginTop: 24 }}>
                <h3>Archivos de Consulta</h3>
                {state.ARCHIVO_ASOCIACION
                  .filter(a => a.entidad === "CONSULTA" && a.entidad_id === state.CONSULTA.id)
                  .length === 0 ? (
                  <p className="no-files">No hay archivos de consulta</p>
                ) : (
                  <div className="files-list">
                    {state.ARCHIVO_ASOCIACION
                      .filter(a => a.entidad === "CONSULTA" && a.entidad_id === state.CONSULTA.id)
                      .map((a) => {
                        const archivo = state.ARCHIVO.find(ar => ar.id === a.archivo_id);
                        const interpretacion = state.INTERPRETACION_ARCHIVO.find(i => i.id_archivo === a.archivo_id);
                        return (
                          <div
  key={a.id}
  className="file-item"
  onClick={() => setPreviewFile(archivo || null)}
  style={{ cursor: "pointer" }}
>

                            <div className="file-item__header">
                              <div className="file-item__icon">
                                {archivo?.tipo.startsWith("image/") ? "🖼️" : "📄"}
                              </div>
                              <div className="file-item__info">
                                <div className="file-item__name">{a.descripcion}</div>
                                <div className="file-item__meta">
                                  <span>Tipo: {archivo?.tipo || "—"}</span>
                                  <span>Fecha: {fmtDate(a.fecha_creacion)}</span>
                                </div>
                              </div>
                            </div>
                            {interpretacion && (
                              <div className="file-item__interpretation">
                                <strong>Interpretación ({interpretacion.fuente}):</strong> {interpretacion.resultado}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Información de Clínica */}
              <div className="clinic-info" style={{ marginTop: 24 }}>
                <h3>Información de Clínica</h3>
                <div className="clinic-info__content">
                  <div className="clinic-info__item">
                    <label>Nombre</label>
                    <span>{state.CLINICA.nombre}</span>
                  </div>
                  <div className="clinic-info__item">
                    <label>Teléfono</label>
                    <span>{state.CLINICA.telefono}</span>
                  </div>
                  <div className="clinic-info__item">
                    <label>Correo</label>
                    <span>{state.CLINICA.correo}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel Derecho - Avatar Médico en Vivo */}
        <div className="patient-view__right">
          <div className="avatar-panel">
            <h2 className="avatar-panel__title">Avatar Médico en Vivo</h2>

            {/* Controles del avatar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
              {avatarStatus === "disconnected" ? (
                <button
                  onClick={startAvatar}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#04121f',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Conectar Avatar
                </button>
              ) : (
                <button
                  onClick={stopAvatar}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--danger)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Desconectar
                </button>
              )}
              <div style={{
                padding: '10px 16px',
                background: avatarStatus === "connected" ? 'var(--success)' : avatarStatus === "connecting" ? 'orange' : 'var(--muted)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'white',
                  display: 'inline-block',
                  animation: avatarStatus === "connecting" ? 'pulse 2s infinite' : 'none'
                }}></span>
                {avatarStatus === "connected" ? "Conectado" : avatarStatus === "connecting" ? "Conectando..." : "Desconectado"}
              </div>
            </div>

            {/* Área para el video del avatar */}
            <div className="avatar-panel__embed" style={{ position: 'relative' }}>
              <video
                ref={videoRef}
                className="avatar-panel__video"
                autoPlay
                playsInline
                muted={false}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '600px',
                  objectFit: 'cover',
                  borderRadius: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  display: 'block', // Siempre visible cuando hay stream
                  zIndex: 2,
                  opacity: avatarStatus === "connected" ? 1 : 0.3
                }}
                onLoadedMetadata={() => {
                  console.log('✅ Video metadata cargado, dimensiones:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
                  if (videoRef.current) {
                    videoRef.current.play().catch(console.warn);
                  }
                }}
                onCanPlay={() => {
                  console.log('✅ Video puede reproducirse');
                  if (videoRef.current) {
                    videoRef.current.play().catch(console.warn);
                  }
                }}
                onPlay={() => {
                  console.log('✅ Video empezó a reproducirse');
                }}
                onError={(e) => {
                  console.error('❌ Error en el video:', e);
                }}
              />
              {avatarStatus === "disconnected" && !videoRef.current?.srcObject && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  zIndex: 1,
                  pointerEvents: 'none'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👨‍⚕️</div>
                  <div>Presiona "Conectar Avatar" para iniciar</div>
                </div>
              )}
              {avatarStatus === "connecting" && !videoRef.current?.srcObject && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  zIndex: 1,
                  pointerEvents: 'none'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                  <div>Conectando...</div>
                </div>
              )}
              {avatarStatus === "connected" && videoRef.current?.srcObject && (
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  zIndex: 3,
                  pointerEvents: 'none'
                }}>
                  Stream activo
                </div>
              )}
            </div>

            {/* Historial de chat */}
            {avatarStatus === "connected" && (
              <div style={{
                marginTop: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--card-border)',
                borderRadius: '12px',
                padding: '16px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--txt)' }}>Conversación</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: msg.sender === "user" ? 'rgba(82, 229, 255, 0.1)' : 'rgba(138, 125, 255, 0.1)',
                        alignSelf: msg.sender === "user" ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        fontSize: '13px',
                        color: 'var(--txt)'
                      }}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input de mensaje */}
            {avatarStatus === "connected" && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Escribe tu mensaje..."
                  disabled={isSpeaking}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '8px',
                    color: 'var(--txt)',
                    fontSize: '14px'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || isSpeaking}
                  style={{
                    padding: '10px 20px',
                    background: isSpeaking || !chatInput.trim() ? 'var(--muted)' : 'var(--primary)',
                    border: 'none',
                    borderRadius: '8px',
                    color: isSpeaking || !chatInput.trim() ? 'var(--txt)' : '#04121f',
                    fontWeight: 600,
                    cursor: isSpeaking || !chatInput.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {isSpeaking ? "..." : "Enviar"}
                </button>
              </div>
            )}
          </div>
        </div>
        {previewFile && (
  <div className="file-modal" onClick={() => setPreviewFile(null)}>
    <div className="file-modal__content" onClick={(e) => e.stopPropagation()}>
      <h3>{previewFile.tipo.startsWith("image") ? "Imagen" : "Documento"}</h3>

      {previewFile.tipo.startsWith("image") ? (
        <img src={previewFile.url} alt="archivo-medico" className="file-modal__image" />
      ) : previewFile.url ? (
        <iframe
          src={previewFile.url}
          className="file-modal__iframe"
          title="Archivo clínico"
        />
      ) : null}

      <button className="file-modal__close" onClick={() => setPreviewFile(null)}>
        Cerrar
      </button>
    </div>
  </div>
)}

      </div>

      <style>{`
        :root{
          /* Tema oscuro - igual al DoctorDashboard */
          --bg-1:#0b1220; --bg-2:#0a1730; --card:rgba(255,255,255,.06);
          --card-border:rgba(255,255,255,.12); --txt:#e6f0ff; --muted:#9bb3d1;
          --primary:#52e5ff; --accent:#8a7dff; --success:#3cf0a5; --danger:#ff5c7c;
        }

        .patient-view {
          position: relative;
          min-height: calc(100vh - 60px);
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          margin-top: -24px;
          padding: 24px;
          color: var(--txt);
          background:
            radial-gradient(1000px 600px at 20% -20%, #15305e40 0%, transparent 60%),
            linear-gradient(180deg,var(--bg-1),var(--bg-2));
        }

        .patient-view::before {
          content: '';
          position: absolute;
          inset: -10%;
          background:
            radial-gradient(800px 800px at 110% 10%, #52e5ff1f 0%, transparent 60%),
            radial-gradient(600px 600px at -10% 110%, #8a7dff1a 0%, transparent 60%);
          filter: blur(20px);
          pointer-events: none;
          z-index: 0;
        }

        .patient-view::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(transparent 95%, #ffffff08 95%),
            linear-gradient(90deg, transparent 95%, #ffffff08 95%);
          background-size: 40px 40px;
          mask-image: radial-gradient(60% 60% at 50% 40%, black 60%, transparent 100%);
          pointer-events: none;
          z-index: 0;
        }

        .patient-view__container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          max-width: 1600px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
          width: 100%;
        }

        /* Panel Izquierdo */
        .patient-view__left {
          background: rgba(255,255,255,.03);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 20px;
          overflow-y: auto;
          max-height: calc(100vh - 40px);
          box-shadow: 0 8px 30px rgba(0,0,0,.3);
        }

        .patient-header {
          margin-bottom: 20px;
          border-bottom: 1px solid var(--card-border);
          padding-bottom: 12px;
        }

        .patient-header__title {
          font-size: 24px;
          font-weight: 700;
          color: var(--txt);
          margin: 0 0 12px 0;
        }

        .patient-header__tabs {
          display: flex;
          gap: 8px;
        }

        .patient-header__tab {
          padding: 8px 16px;
          border: none;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .patient-header__tab:hover {
          background: rgba(255,255,255,.04);
        }

        .patient-header__tab--active {
          background: linear-gradient(135deg, var(--primary), var(--accent));
          color: #04121f;
          font-weight: 600;
        }

        .patient-section, .parts-section {
          margin-top: 16px;
        }

        .patient-section__header, .parts-section__header {
          margin-bottom: 12px;
        }

        .patient-section__toggle, .parts-section__toggle {
          font-weight: 600;
          color: var(--txt);
          cursor: pointer;
        }

        .patient-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--card-border);
        }

        .patient-info__main {
          flex: 1;
        }

        .patient-info__details {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: var(--muted);
          font-size: 14px;
        }

        .patient-info__details span {
          color: var(--txt);
        }

        .patient-info__photo {
          width: 160px;
          height: 160px;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid var(--card-border);
          box-shadow: 0 4px 12px rgba(0,0,0,.3);
          flex-shrink: 0;
        }

        .patient-info__photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .critical-info {
          background: rgba(255, 92, 124, .1);
          border: 1px solid rgba(255, 92, 124, .3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .critical-info__title {
          font-size: 16px;
          font-weight: 700;
          color: var(--danger);
          margin: 0 0 12px 0;
        }

        .critical-info__content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .critical-item {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .critical-item__code {
          font-weight: 700;
          color: var(--txt);
        }

        .critical-item__text {
          color: var(--txt);
        }

        .critical-diagnosis {
          font-size: 13px;
          color: var(--txt);
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .critical-allergies {
          font-size: 13px;
          color: var(--txt);
        }

        .conditions-section {
          margin-bottom: 24px;
        }

        .conditions-section__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .conditions-section__header h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--txt);
          margin: 0;
        }

        .conditions-section__page {
          font-size: 12px;
          color: var(--muted);
        }

        .conditions-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          overflow: hidden;
        }

        .conditions-table thead {
          background: rgba(255,255,255,.04);
        }

        .conditions-table th {
          padding: 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          border-bottom: 1px solid var(--card-border);
        }

        .conditions-table td {
          padding: 12px;
          font-size: 14px;
          color: var(--txt);
          border-bottom: 1px solid var(--card-border);
        }

        .conditions-table tbody tr:last-child td {
          border-bottom: none;
        }

        .condition-status {
          font-size: 13px;
        }

        .general-info {
          margin-top: 24px;
        }

        .general-info h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--txt);
          margin: 0 0 16px 0;
        }

        .general-info__grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-item label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }

        .info-item span {
          font-size: 14px;
          color: var(--txt);
        }

        .pre-diagnosis {
          margin-top: 24px;
          padding: 16px;
          background: rgba(255,255,255,.04);
          border: 1px dashed var(--card-border);
          border-radius: 12px;
        }

        .pre-diagnosis h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--txt);
          margin: 0 0 8px 0;
        }

        .pre-diagnosis__text {
          font-size: 14px;
          color: var(--txt);
          line-height: 1.6;
          margin: 0;
        }

        /* Sección de Partes */
        .files-section {
          margin-bottom: 24px;
        }

        .files-section h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--txt);
          margin: 0 0 16px 0;
        }

        .no-files {
          color: var(--muted);
          font-size: 14px;
          text-align: center;
          padding: 20px;
          background: rgba(255,255,255,.04);
          border-radius: 8px;
        }

        .files-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .file-item {
          background: rgba(255,255,255,.03);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 16px;
        }

        .file-item__header {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .file-item__icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .file-item__info {
          flex: 1;
        }

        .file-item__name {
          font-size: 16px;
          font-weight: 600;
          color: var(--txt);
          margin-bottom: 6px;
        }

        .file-item__meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--muted);
        }

        .file-item__interpretation {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--card-border);
          font-size: 13px;
          color: var(--txt);
          line-height: 1.6;
        }

        .file-item__interpretation strong {
          color: var(--primary);
        }

        .clinic-info {
          background: rgba(255,255,255,.03);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 16px;
        }

        .clinic-info h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--txt);
          margin: 0 0 16px 0;
        }

        .clinic-info__content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .clinic-info__item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .clinic-info__item label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }

        .clinic-info__item span {
          font-size: 14px;
          color: var(--txt);
        }

        /* Panel Derecho */
        .patient-view__right {
          background: rgba(255,255,255,.03);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 20px;
          overflow-y: auto;
          max-height: calc(100vh - 40px);
          box-shadow: 0 8px 30px rgba(0,0,0,.3);
        }

        .avatar-panel__title {
          font-size: 20px;
          font-weight: 700;
          color: var(--txt);
          margin: 0 0 20px 0;
        }

        .avatar-panel__embed {
          width: 100%;
          min-height: 600px;
          height: 600px;
          background: rgba(0,0,0,.2);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }

        .avatar-panel__video {
          width: 100% !important;
          height: 100% !important;
          min-height: 600px !important;
          border: none;
          display: block !important;
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          position: relative;
          z-index: 2;
        }

        @media (max-width: 1200px) {
          .patient-view__container {
            grid-template-columns: 1fr;
          }
        }

        .file-modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
        }
        
        .file-modal__content {
          background: #0f182a;
          border: 1px solid var(--card-border);
          padding: 20px;
          border-radius: 12px;
          width: 80%;
          max-width: 900px;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 8px 30px rgba(0,0,0,.4);
        }
        
        .file-modal__image {
          width: 100%;
          border-radius: 12px;
          margin-top: 16px;
        }
        
        .file-modal__iframe {
          width: 100%;
          height: 70vh;
          border: none;
          margin-top: 16px;
          border-radius: 12px;
        }
        
        .file-modal__close {
          margin-top: 20px;
          padding: 10px 20px;
          background: var(--danger);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        
      `}</style>
    </div>
  );
}
