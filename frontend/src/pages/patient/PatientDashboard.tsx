import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import toast from "react-hot-toast";
import PatientView from "./PatientView";

// === Types ===
type Patient = {
  id?: string;
  name: string;
  sex?: string;
  age?: string | number;
  height?: string | number;
  weight?: string | number;
  bloodType?: string;
  allergies?: string;
  phone?: string;
  email?: string;
  address?: string;
  maritalStatus?: string;
  occupation?: string;
};

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  license: string;
  phone: string;
  email: string;
  location: string;
  about?: string;
};

type Appointment = {
  id: string;
  date: string;
  time?: string;
  withDoctorId: string;
  diagnosisSummary?: string;
  prescription?: string;
  recommendations?: string;
};

type AISummary = {
  id: string;
  date: string;
  summary: string;
};

export default function PatientDashboard() {
  const [me, setMe] = useState<Patient>({ name: "Yo" });
  const [active, setActive] = useState<Patient | null>(null);
  const [view, setView] = useState<"home" | "details" | "ai" | "doctor">("home");
  //tabs de la vista doctor
  type PtTab = 'general' | 'consulta' | 'episodio' | 'archivos' | 'avatar' | 'ai';
  const [ptTab, setPtTab] = useState<PtTab>('general');


  // Datos doctor / citas demo
  const [doctors] = useState<Doctor[]>([{
    id: "dr-jose",
    name: "Dr. José",
    specialty: "Medicina Interna",
    license: "Céd. Prof. 12345678",
    phone: "+52 81 1234 5678",
    email: "jose.med@hospital.mx",
    location: "Consultorio 402, Torre Médica San Pedro",
    about: "15+ años de experiencia en medicina interna, enfoque en prevención, control metabólico y salud integral.",
  }]);
  const defaultDoctor = doctors[0];

  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: "appt-2025-09-05",
      date: "2025-09-05",
      time: "10:30",
      withDoctorId: "dr-jose",
      diagnosisSummary: "Cefalea tensional relacionada con estrés; signos vitales dentro de parámetros.",
      prescription: "Paracetamol 500mg c/8h por 2 días; hidratación; descanso visual 20-20-20.",
      recommendations: "Dormir 7–8h, pausas activas cada 60 min, limitar cafeína a 1–2 tazas/día.",
    },
    {
      id: "appt-2025-09-10",
      date: "2025-09-10",
      time: "16:00",
      withDoctorId: "dr-jose",
      diagnosisSummary: "Rinitis alérgica estacional; respuesta favorable a medidas ambientales.",
      prescription: "Loratadina 10mg VO al día por 7 días; lavado nasal salino.",
      recommendations: "Ventilar habitación, aspirar polvo 2x/sem, fundas antiácaros.",
    },
  ]);

  // IA por día demo
  const [aiDaily] = useState<AISummary[]>([
    {
      id: "ai-2025-09-05",
      date: "2025-09-05",
      summary: "La IA sugiere manejo de dolor leve con analgésicos OTC, hidratación y pausas activas; sin banderas rojas detectadas por los síntomas descritos ese día.",
    },
    {
      id: "ai-2025-09-10",
      date: "2025-09-10",
      summary: "Recomendaciones para rinitis: antihistamínico diario, higiene ambiental, y monitoreo de síntomas en 72 horas. Sugiere control de calidad del aire interior.",
    },
  ]);

  const [selectedAIDate, setSelectedAIDate] = useState<string | null>(aiDaily[0]?.id || null);
  const selectedAISummary = useMemo(
    () => aiDaily.find(s => s.id === selectedAIDate) || null,
    [aiDaily, selectedAIDate]
  );

  // Cargar perfil desde API (si existe)
  useEffect(() => {
    const { owner } = api.patient.listProfiles();
    if (owner) {
      setMe({ ...owner });
      setActive({ ...owner });
    } else {
      setActive(me);
    }
  }, []);

  // Modal: cerrar con ESC
  useEffect(() => {
    if (view !== "details" && view !== "ai" && view !== "doctor") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setView("home"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  const updateActive = (key: keyof Patient, value: any) => {
    if (!active) return;
    const s = api.patient.saveProfile({ ...active, [key]: value });
    setMe(s.saved);
    setActive(s.saved);
  };

  // === Appointment scheduling ===
  const [newApptDate, setNewApptDate] = useState("");
  const [newApptTime, setNewApptTime] = useState("");

  const scheduleAppointment = () => {
    if (!newApptDate) return toast.error("Selecciona una fecha");
    const id = `appt-${newApptDate}${newApptTime ? "-" + newApptTime.replace(":", "") : ""}`;
    const appt: Appointment = {
      id,
      date: newApptDate,
      time: newApptTime || undefined,
      withDoctorId: defaultDoctor.id,
    };
    setAppointments(prev =>
      [appt, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1))
    );
    toast.success("Cita agendada (demo)");
    setNewApptDate("");
    setNewApptTime("");
  };


  // Usar el nuevo PatientView simplificado
  return <PatientView />;
}
// === UI Auxiliar: LabeledInput ===
function LabeledInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="labeled">
      <span>{label}</span>
      {children}
      <style>{`
        .labeled{display:flex; flex-direction:column; gap:8px}
        .labeled > span{font-size:12px; color: var(--muted); letter-spacing:.2px}
      `}</style>
    </label>
  );
}

// === Utils ===
function formatDate(iso: string) {
  try {
    const [y, m, d] = iso.split("-");
    const asDate = new Date(Number(y), Number(m) - 1, Number(d));
    return asDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

