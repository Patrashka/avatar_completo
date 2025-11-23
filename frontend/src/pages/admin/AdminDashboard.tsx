import React, { useState, useRef, useEffect } from "react";
import { api } from "../../services/api";
import toast from "react-hot-toast";

type Interaction = {
  _id: string;
  tipo: string;
  fecha: string;
  mensaje_usuario?: string;
  respuesta_ia?: string;
  paciente_id?: number;
  usuario_id?: number;
  modelo_ia?: string;
};

export default function AdminDashboard() {
  const [status, setStatus] = useState("🔴 Conectando con el avatar...");
  const [showMicContainer, setShowMicContainer] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [text, setText] = useState("");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [showInteractions, setShowInteractions] = useState(false);
  const [loadingInteractions, setLoadingInteractions] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const BASE_URL = import.meta.env.VITE_API || "http://localhost:8080";

  // Cargar interacciones
  const loadInteractions = async () => {
    setLoadingInteractions(true);
    try {
      const response = await fetch(`${BASE_URL}/api/db/interactions?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setInteractions(data.interactions || []);
      }
    } catch (err) {
      console.error("Error cargando interacciones:", err);
      toast.error("Error al cargar interacciones");
    } finally {
      setLoadingInteractions(false);
    }
  };

  useEffect(() => {
    if (showInteractions) {
      loadInteractions();
    }
  }, [showInteractions]);

  const startAvatar = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/avatar/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      streamIdRef.current = data.id;
      sessionIdRef.current = data.session_id;
      await initWebRTC(data.id, data.offer);
    } catch {
      setStatus("⚠️ Error al conectar avatar.");
    }
  };

  const initWebRTC = async (id: string, remoteOffer: RTCSessionDescriptionInit) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    pcRef.current = pc;

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
      setStatus("🟢 Avatar conectado");
      greetAvatar();
    };

    await pc.setRemoteDescription(remoteOffer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await fetch(`${BASE_URL}/api/avatar/sdp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stream_id: id,
        answer,
        session_id: sessionIdRef.current,
      }),
    });
  };

  const greetAvatar = async () => {
    setShowLoader(true);
    setSpeaking(true);
    try {
      const res = await fetch(`${BASE_URL}/api/ai/avatar-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Hola",
          stream_id: streamIdRef.current,
          session_id: sessionIdRef.current,
        }),
      });
      await res.json();
      setTimeout(() => {
        setShowLoader(false);
        setSpeaking(false);
        setShowMicContainer(true);
      }, 4000);
    } catch (err) {
      console.error("Error saludando al avatar:", err);
      setShowLoader(false);
      setSpeaking(false);
    }
  };

  const toggleRecording = async () => {
    if (speaking) return;
    if (recording) {
      setRecording(false);
      mediaRecorderRef.current?.stop();
      return;
    }

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
    setRecording(true);
  };

  const processAudio = async (blob: Blob) => {
    try {
      setShowLoader(true);
      setSpeaking(true);

      const formData = new FormData();
      formData.append("file", blob, "voz_usuario.wav");

      const sttRes = await fetch(`${BASE_URL}/api/ai/speech-to-text`, {
        method: "POST",
        body: formData,
      });
      const sttData = await sttRes.json();

      await sendMessageToAvatar(sttData.text || sttData.input_text || "");
    } catch (err) {
      console.error("❌ Error en processAudio:", err);
    } finally {
      setShowLoader(false);
      setSpeaking(false);
    }
  };

  const sendTextMessage = async () => {
    if (!text.trim() || speaking) return;
    setShowLoader(true);
    setSpeaking(true);
    await sendMessageToAvatar(text.trim());
    setText("");
    setShowLoader(false);
    setSpeaking(false);
  };

  const sendMessageToAvatar = async (message: string) => {
    try {
      const aiRes = await fetch(`${BASE_URL}/api/ai/avatar-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          stream_id: streamIdRef.current,
          session_id: sessionIdRef.current,
          // Nota: Admin no tiene paciente_id, pero se guardará igual
        }),
      });
      const res = await aiRes.json();
      console.log("🧠 Respuesta:", res.ai_response);
      
      // Recargar interacciones si el panel está abierto
      if (showInteractions) {
        setTimeout(loadInteractions, 1000);
      }
    } catch (err) {
      console.error("Error enviando texto al avatar:", err);
    }
  };

  return (
    <div style={styles.body}>
      <h1 style={styles.h1}>🩺 AI-MedAssistant</h1>
      <div id="status" style={styles.status}>
        {status}
      </div>
      <video ref={videoRef} autoPlay playsInline style={styles.video}></video>

      <button id="startBtn" style={styles.startBtn} onClick={startAvatar}>
        Iniciar conversación
      </button>

      {showMicContainer && (
        <div id="micContainer" style={styles.micContainer}>
          <div id="textContainer" style={styles.textContainer}>
            <input
              id="textInput"
              type="text"
              placeholder="Escribe aquí..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
              style={styles.textInput}
            />
            <button id="sendBtn" style={styles.sendBtn} onClick={sendTextMessage}>
              Enviar
            </button>
          </div>

          <div
            id="micBtn"
            onClick={toggleRecording}
            style={{
              ...styles.micBtn,
              background: recording ? "#e74c3c" : "#777",
              boxShadow: recording ? "0 0 20px rgba(231,76,60,0.6)" : "none",
            }}
          >
            <div style={styles.micIcon}></div>
          </div>
        </div>
      )}

      {showLoader && <div style={styles.loader}>⏳ El avatar está pensando...</div>}

      {/* Panel de Interacciones */}
      <button
        onClick={() => setShowInteractions(!showInteractions)}
        style={styles.interactionsBtn}
      >
        {showInteractions ? "❌ Ocultar" : "📊 Ver Interacciones"}
      </button>

      {showInteractions && (
        <div style={styles.interactionsPanel}>
          <h2 style={styles.interactionsTitle}>Interacciones de IA Guardadas</h2>
          <button
            onClick={loadInteractions}
            style={styles.refreshBtn}
            disabled={loadingInteractions}
          >
            {loadingInteractions ? "🔄 Cargando..." : "🔄 Actualizar"}
          </button>
          
          {interactions.length === 0 ? (
            <p style={styles.noData}>No hay interacciones guardadas aún.</p>
          ) : (
            <div style={styles.interactionsList}>
              {interactions.map((interaction) => (
                <div key={interaction._id} style={styles.interactionCard}>
                  <div style={styles.interactionHeader}>
                    <span style={styles.interactionType}>{interaction.tipo}</span>
                    <span style={styles.interactionDate}>
                      {new Date(interaction.fecha).toLocaleString('es-ES')}
                    </span>
                  </div>
                  {interaction.paciente_id && (
                    <div style={styles.interactionMeta}>
                      Paciente ID: {interaction.paciente_id}
                    </div>
                  )}
                  {interaction.mensaje_usuario && (
                    <div style={styles.userMessage}>
                      <strong>Usuario:</strong> {interaction.mensaje_usuario}
                    </div>
                  )}
                  {interaction.respuesta_ia && (
                    <div style={styles.aiResponse}>
                      <strong>IA:</strong> {interaction.respuesta_ia}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  body: {
    backgroundColor: "#0e0e0e",
    color: "white",
    fontFamily: "Segoe UI, Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    margin: 0,
  },
  h1: { marginBottom: 10, fontWeight: 500, letterSpacing: "1px" },
  status: { marginBottom: 20, color: "#aaa", transition: "color 0.3s ease" },
  video: {
    width: 420,
    height: 420,
    background: "black",
    borderRadius: 12,
    boxShadow: "0 0 25px rgba(255,255,255,0.1)",
  },
  startBtn: {
    marginTop: 20,
    padding: "15px 20px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(45deg, #2ecc71, #27ae60)",
    color: "white",
    fontSize: 18,
    cursor: "pointer",
  },
  micContainer: {
    marginTop: 25,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 15,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    border: "3px solid #222",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  micIcon: {
    width: 30,
    height: 45,
    borderRadius: 15,
    border: "4px solid white",
    position: "relative",
  },
  textContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    width: 300,
    padding: 10,
    borderRadius: 10,
    border: "none",
    background: "#222",
    color: "white",
    fontSize: 16,
    outline: "none",
  },
  sendBtn: {
    padding: "10px 15px",
    borderRadius: 8,
    border: "none",
    background: "#3498db",
    color: "white",
    fontSize: 16,
    cursor: "pointer",
  },
  loader: {
    marginTop: 15,
    fontSize: 15,
    color: "#0ff",
    animation: "blink 1s infinite",
  },
  interactionsBtn: {
    marginTop: 20,
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#9b59b6",
    color: "white",
    fontSize: 14,
    cursor: "pointer",
  },
  interactionsPanel: {
    marginTop: 20,
    padding: 20,
    background: "#1a1a1a",
    borderRadius: 12,
    border: "1px solid #333",
    maxWidth: 800,
    maxHeight: "60vh",
    overflowY: "auto",
  },
  interactionsTitle: {
    margin: "0 0 15px 0",
    fontSize: 20,
    color: "#fff",
  },
  refreshBtn: {
    marginBottom: 15,
    padding: "8px 15px",
    borderRadius: 6,
    border: "none",
    background: "#3498db",
    color: "white",
    fontSize: 12,
    cursor: "pointer",
  },
  noData: {
    color: "#aaa",
    textAlign: "center",
    padding: 20,
  },
  interactionsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  interactionCard: {
    padding: 15,
    background: "#222",
    borderRadius: 8,
    border: "1px solid #333",
  },
  interactionHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  interactionType: {
    background: "#3498db",
    color: "white",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: "bold",
  },
  interactionDate: {
    color: "#aaa",
    fontSize: 12,
  },
  interactionMeta: {
    color: "#888",
    fontSize: 12,
    marginBottom: 8,
  },
  userMessage: {
    color: "#e74c3c",
    marginBottom: 8,
    padding: 8,
    background: "#2a1a1a",
    borderRadius: 4,
  },
  aiResponse: {
    color: "#2ecc71",
    padding: 8,
    background: "#1a2a1a",
    borderRadius: 4,
  },
};