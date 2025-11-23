import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

type VisualMsg = { type: "user" | "ai"; text: string; preview?: string | null; fileType?: string };

export default function VisualAnalyzePanel({
  storageKey = "analyzeHistory",
  endpointUrl = "http://localhost:8080/api/ai/file/analyze_xml",
  accept = "image/*,.pdf",
  title = "Análisis Visual",
}: {
  storageKey?: string;
  endpointUrl?: string;
  accept?: string;
  title?: string;
}) {
  const [aiTyping, setAiTyping] = useState(false);
  const [messages, setMessages] = useState<VisualMsg[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      // Guardar SOLO lo que SÍ es persistente
      const saved = messages.map((m) => ({
        type: m.type,
        text: m.text,
        fileType: m.fileType
      }));
  
      localStorage.setItem(storageKey, JSON.stringify(saved));
  
      console.debug(`[VisualAnalyzePanel] saved ${saved.length} messages -> key=`, storageKey);
    } catch (e) {
      console.debug('[VisualAnalyzePanel] error saving messages', e);
    }
  }, [messages, storageKey]);
  

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      let parsed: any = null;
      try { parsed = raw ? JSON.parse(raw) : []; } catch {}
      // avoid printing large binary previews
      const safe = Array.isArray(parsed) ? parsed.map((m:any) => ({ type: m.type, text: m.text, fileType: m.fileType })) : parsed;
      console.debug('[VisualAnalyzePanel] init load', { storageKey, safe });
    } catch (e) { console.debug('[VisualAnalyzePanel] init parse error', e); }

    try {
      (window as any)[`__dump_${storageKey}`] = () => {
        const v = localStorage.getItem(storageKey);
        console.log(`__dump_${storageKey}:`, v ? JSON.parse(v) : null);
        return v ? JSON.parse(v) : null;
      };
    } catch (_) {}
  }, [storageKey]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewURL = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");

    setMessages((p) => [
      ...p,
      { type: "user", fileType: file.type, preview: isImage ? previewURL : undefined, text: file.name },
    ]);
    

    setAiTyping(true);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(endpointUrl, { method: "POST", body: form });
      const xmlText = await res.text();
      const xml = new DOMParser().parseFromString(xmlText, "application/xml");
      const aiResp =
        xml.getElementsByTagName("raw_model_text")[0]?.textContent ||
        xml.getElementsByTagName("text_excerpt")[0]?.textContent ||
        "(Sin análisis)";
      setMessages((p) => [...p, { type: "ai", text: aiResp }]);
    } catch (err) {
      console.error("Error analizando archivo:", err);
      toast.error("Error al analizar archivo");
    } finally {
      setAiTyping(false);
    }
  };

  return (
    <section className="aiPanel">
      <h2 className="titleSmall">{title}</h2>
      <div className="chatBox">
        <div className="chatWindow">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.type}`}>
              {m.preview ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <img
                    src={m.preview}
                    alt={m.text}
                    style={{ maxWidth: "220px", borderRadius: "10px", marginBottom: "8px" }}
                  />
                  <span style={{ fontSize: "0.9rem", opacity: 0.8 }}>{m.text}</span>
                </div>
              ) : (
                m.text
              )}
            </div>
          ))}
          {aiTyping && (
            <div className="dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
        <div className="inputRow">
          <label className="fileBtn">
            Subir archivo
            <input type="file" accept={accept} onChange={handleFileUpload} hidden />
          </label>
        </div>
      </div>

      <style>{`
        .aiPanel { display:flex; flex-direction:column; align-items:center; gap:14px; }
        .titleSmall { font-size:1.1rem; font-weight:700; background:linear-gradient(90deg,#56e0ff,#8a7dff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .chatBox { width:100%; max-width:650px; background:#0e162b; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 0 20px #0008; }
        .chatWindow { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; max-height:420px; }
        .bubble { padding:10px 16px; border-radius:14px; max-width:75%; line-height:1.5; animation:fadeIn .3s ease; }
        .bubble.user { align-self:flex-end; background:linear-gradient(135deg,#56e0ff,#8a7dff); color:#0a0a12; }
        .bubble.ai { align-self:flex-start; background:#1b2647; color:#e8f0ff; white-space:pre-wrap; }
        .inputRow { display:flex; justify-content:center; padding:10px; background:#111b36; }
        .fileBtn { background:#1b2647; color:#fff; border-radius:8px; padding:10px 16px; cursor:pointer; }
        .dots { display:flex; gap:6px; margin:8px 0; }
        .dots span { width:8px; height:8px; background:#56e0ff; border-radius:50%; animation:bounce 1s infinite; }
        .dots span:nth-child(2){animation-delay:.2s;} .dots span:nth-child(3){animation-delay:.4s;}
        @keyframes bounce{0%,80%,100%{transform:scale(0);}40%{transform:scale(1);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
      `}</style>
    </section>
  );
}

