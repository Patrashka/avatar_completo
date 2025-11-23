import React, { useEffect, useState } from "react";

const BASE_URL = "https://1c3aeee07025.ngrok-free.app";

interface SimPopupProps {
  visible: boolean;
  title: string;
  payload: string;
  image?: string;
  streamId: string | null;
  sessionId: string | null;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

/**
 * Popup fullscreen con avatar + typing
 */
export default function SimPopupWithAvatar({
  visible,
  title,
  payload,
  image,
  streamId,
  sessionId,
  onClose,
  videoRef,
}: SimPopupProps) {
  const [typing, setTyping] = useState(true);
  const [displayText, setDisplayText] = useState("");

  // ⌨️ Animación de typing
  useEffect(() => {
    if (!visible) return;

    setDisplayText("");
    setTyping(true);

    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(payload.slice(0, i));
      i++;

      if (i > payload.length) {
        clearInterval(interval);
        setTyping(false);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [payload, visible]);


  // 🧠 Mandar al avatar apenas se abra
  useEffect(() => {
    if (!visible || !streamId || !sessionId) return;

    async function speak() {
      try {
        await fetch(`${BASE_URL}/api/ai/avatar-response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: payload,
            stream_id: streamId,
            session_id: sessionId,
          }),
        });
      } catch (err) {
        console.error("Avatar speak error:", err);
      }
    }

    speak();
  }, [visible]);


  if (!visible) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER */}
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* CONTENIDO */}
        <div style={styles.content}>
          {/* AVATAR */}
          <div style={styles.avatarBox}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={styles.avatarVideo}
            />
            {typing && (
              <div style={styles.avatarSpeakingTag}>Hablando…</div>
            )}
          </div>

          {/* TEXTO */}
          <div style={styles.textBox}>
            <p style={styles.typingText}>{displayText}</p>
            {typing && <span style={styles.cursor}>▌</span>}
          </div>
        </div>

        {/* IMAGEN OPCIONAL */}
        {image && (
          <div style={styles.imageWrap}>
            <img src={image} style={styles.image} />
          </div>
        )}
        
      </div>
    </div>
  );
}


// ===== ESTILOS FULLSCREEN =====
const styles:any = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    zIndex: 999999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backdropFilter: "blur(5px)",
  },

  modal: {
    width: "85%",
    height: "85%",
    background: "#101623",
    borderRadius: 16,
    border: "1px solid #344",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  title: {
    fontSize: 22,
    color: "white",
  },

  closeBtn: {
    background: "transparent",
    border: "none",
    color: "white",
    fontSize: 20,
    cursor: "pointer",
  },

  content: {
    display: "flex",
    flexDirection: "row",
    gap: 25,
    height: "50%",
  },

  avatarBox: {
    width: "40%",
    position: "relative",
  },

  avatarVideo: {
    width: "100%",
    borderRadius: 12,
    background: "black",
  },

  avatarSpeakingTag: {
    position: "absolute",
    bottom: 10,
    right: 10,
    padding: "5px 12px",
    background: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    color: "white",
    fontSize: 13,
  },

  textBox: {
    width: "60%",
    background: "#1a2236",
    borderRadius: 10,
    padding: 15,
    color: "white",
    fontSize: 15,
    lineHeight: "1.5em",
    whiteSpace: "pre-wrap",
    overflowY: "auto",
    position: "relative",
  },

  typingText: {},

  cursor: {
    color: "#52e5ff",
    marginLeft: 6,
    animation: "blink 1s infinite",
  },

  imageWrap: {
    marginTop: 20,
  },

  image: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #233",
  },
};

