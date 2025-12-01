import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import toast from "react-hot-toast";

interface ConversationSummariesTabProps {
  patientId: number;
}

interface DateConversations {
  dates: string[];
  conversations_by_date: Record<string, any[]>;
  total_days: number;
  total_conversations: number;
}

interface DailySummary {
  date: string;
  summary: string;
  highlights: string[];
  conversation_count: number;
  message_count: number;
  error?: string;
}

export default function ConversationSummariesTab({ patientId }: ConversationSummariesTabProps) {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [conversationsByDate, setConversationsByDate] = useState<Record<string, any[]>>({});

  // Cargar fechas con conversaciones
  useEffect(() => {
    if (!patientId || patientId === 0) {
      setLoadingDates(false);
      return;
    }

    const loadDates = async () => {
      try {
        setLoadingDates(true);
        const data = await api.doctor.getConversationsByDate(patientId);
        
        if (data && data.dates) {
          setDates(data.dates || []);
          setConversationsByDate(data.conversations_by_date || {});
        } else {
          setDates([]);
          setConversationsByDate({});
        }
      } catch (error) {
        console.error("Error cargando fechas:", error);
        toast.error("Error al cargar fechas de conversaciones");
        setDates([]);
        setConversationsByDate({});
      } finally {
        setLoadingDates(false);
      }
    };

    loadDates();
  }, [patientId]);

  // Cargar resumen cuando se selecciona una fecha
  useEffect(() => {
    if (!selectedDate || !patientId || patientId === 0) {
      setSummary(null);
      return;
    }

    const loadSummary = async () => {
      try {
        setLoadingSummary(true);
        const data = await api.doctor.getDailySummary(patientId, selectedDate);
        
        if (data) {
          setSummary(data);
        } else {
          toast.error("No se pudo generar el resumen");
          setSummary(null);
        }
      } catch (error) {
        console.error("Error cargando resumen:", error);
        toast.error("Error al generar resumen con Gemini");
        setSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    };

    loadSummary();
  }, [selectedDate, patientId]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getConversationCount = (date: string) => {
    return conversationsByDate[date]?.length || 0;
  };

  if (!patientId || patientId === 0) {
    return (
      <div className="subcard" style={{ padding: "24px", textAlign: "center" }}>
        <p className="muted">Selecciona un paciente para ver los resúmenes de conversaciones</p>
      </div>
    );
  }

  return (
    <div style={{ 
      display: "grid", 
      gridTemplateColumns: "320px 1fr", 
      gap: "20px", 
      marginTop: "18px" 
    }}>
      {/* Columna izquierda: Lista de fechas */}
      <div className="subcard">
        <h3>Días con conversaciones</h3>
        
        {loadingDates ? (
          <div className="muted" style={{ padding: "16px", textAlign: "center" }}>
            Cargando fechas...
          </div>
        ) : dates.length === 0 ? (
          <div className="muted" style={{ padding: "16px", textAlign: "center" }}>
            No se encontraron conversaciones para este paciente
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {dates.map((date) => {
              const count = getConversationCount(date);
              const isSelected = selectedDate === date;
              
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    padding: "12px 16px",
                    background: isSelected
                      ? "rgba(82, 229, 255, 0.15)"
                      : "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${
                      isSelected ? "rgba(82, 229, 255, 0.4)" : "rgba(255, 255, 255, 0.12)"
                    }`,
                    borderRadius: "10px",
                    color: "var(--txt)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                    }
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                    {formatDate(date)}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                    }}
                  >
                    {count} {count === 1 ? "conversación" : "conversaciones"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Columna derecha: Resumen del día seleccionado */}
      <div className="subcard">
        <h3>
          {selectedDate ? `Resumen del ${formatDate(selectedDate)}` : "Selecciona un día"}
        </h3>

        {!selectedDate ? (
          <div className="muted" style={{ padding: "16px", textAlign: "center" }}>
            Selecciona un día de la lista para ver el resumen generado por Gemini
          </div>
        ) : loadingSummary ? (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <div className="muted">Generando resumen con Gemini...</div>
            <div
              style={{
                marginTop: "16px",
                fontSize: "14px",
                color: "var(--muted)",
              }}
            >
              Esto puede tomar unos segundos
            </div>
          </div>
        ) : summary ? (
          <div>
            {/* Estadísticas */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                marginBottom: "20px",
                padding: "12px",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: "8px",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Conversaciones
                </div>
                <div style={{ fontSize: "18px", fontWeight: 600 }}>
                  {summary.conversation_count}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Mensajes
                </div>
                <div style={{ fontSize: "18px", fontWeight: 600 }}>
                  {summary.message_count}
                </div>
              </div>
            </div>

            {/* Resumen principal */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "12px", fontSize: "16px" }}>Resumen General</h4>
              <div
                style={{
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "10px",
                  lineHeight: "1.6",
                  color: "var(--txt)",
                }}
              >
                {summary.summary}
              </div>
            </div>

            {/* Puntos destacados */}
            {summary.highlights && summary.highlights.length > 0 && (
              <div>
                <h4 style={{ marginBottom: "12px", fontSize: "16px" }}>Puntos Destacados</h4>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {summary.highlights.map((highlight, index) => (
                    <li
                      key={index}
                      style={{
                        padding: "12px 16px",
                        background: "rgba(82, 229, 255, 0.08)",
                        border: "1px solid rgba(82, 229, 255, 0.2)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--primary)",
                          fontWeight: 600,
                          fontSize: "14px",
                        }}
                      >
                        •
                      </span>
                      <span style={{ flex: 1, lineHeight: "1.5" }}>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.error && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  background: "rgba(255, 92, 124, 0.1)",
                  border: "1px solid rgba(255, 92, 124, 0.3)",
                  borderRadius: "8px",
                  color: "var(--danger)",
                  fontSize: "14px",
                }}
              >
                ⚠️ {summary.error}
              </div>
            )}
          </div>
        ) : (
          <div className="muted" style={{ padding: "16px", textAlign: "center" }}>
            No se pudo generar el resumen. Intenta nuevamente.
          </div>
        )}
      </div>
    </div>
  );
}

