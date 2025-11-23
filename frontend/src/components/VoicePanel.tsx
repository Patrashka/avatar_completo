import React, { useRef, useState } from "react";

/**
 * VoicePanel – versión portada 1:1 desde AdminDashboard
 * - Misma lógica de WebRTC, saludo inicial y envío de texto
 * - Misma UI básica y estilos inline
 *
 * Nota: Asegúrate de que BASE_URL apunte a tu backend actual.
 */
export default function VoicePanel() {
  const [status, setStatus] = useState("🔴 Conectando con el avatar...");
  const [showMicContainer, setShowMicContainer] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [text, setText] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // 💡 Ajusta esta URL a tu túnel/host actual
  const BASE_URL = "https://1c3aeee07025.ngrok-free.app";

  const startAvatar = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/avatar/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      streamIdRef.current = data.id;
      sessionIdRef.current = data.session_id;
      await initWebRTC(data.id, data.offer, data.ice_servers);

    } catch (e) {
      console.error(e);
      setStatus("⚠️ Error al conectar avatar.");
    }
  };

  const initWebRTC = async (id: string, remoteOffer: RTCSessionDescriptionInit, iceServers: any[]) => {
    const pc = new RTCPeerConnection({
      iceServers: iceServers,
    });    
    pcRef.current = pc;

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("📡 Enviando ICE candidate al backend:", event.candidate);
    
        await fetch(`${BASE_URL}/api/avatar/ice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stream_id: id,
            candidate: event.candidate,
            session_id: sessionIdRef.current,
          }),
        });
      }
    };
    

    pc.oniceconnectionstatechange = () => {
      console.log("ICE STATE:", pc.iceConnectionState);
    };

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

      // ✅ Usa el endpoint que sí existe
      const sttRes = await fetch(`${BASE_URL}/api/ai/speech-to-text`, {
        method: "POST",
        body: formData,
      });

      if (!sttRes.ok) {
        throw new Error(`Error STT: ${sttRes.status}`);
      }

      // ✅ Esta API devuelve {"text": "..."}
      const sttData = await sttRes.json();

      // ✅ Pasa el texto correcto al avatar
      await sendMessageToAvatar(sttData.text);
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
        }),
      });
      const res = await aiRes.json();
      console.log("🧠 Respuesta:", res.ai_response);
    } catch (err) {
      console.error("Error enviando texto al avatar:", err);
    }
  };

  return (
    <div style={styles.body}>
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
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  body: {
    
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
};
