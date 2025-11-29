import React, { useMemo, useState, useEffect, useRef } from "react";
import { api } from "../../services/api";
import toast from "react-hot-toast";

/** ===== Tipos (opcionales para TS) ===== */
type Catalogo = { id: number; nombre: string };
type Archivo = { id: number; tipo: string; url: string; hash_integridad: string; creado_en: string };
type ArchivoAsoc = { id: number; archivo_id: number; entidad: string; entidad_id: number; descripcion: string; creado_por_usuario_id: number; fecha_creacion: string };
type Interpretacion = { id: number; id_archivo: number; id_medico: number; id_consulta: number; fuente: string; resultado: string; fecha: string };
type SesionAvatar = { id: number; id_usuario: number; id_paciente: number; id_medico: number; fecha_inicio: string; fecha_fin: string | "" };
type Auditoria = { id: number; usuario_id: number; accion: string; entidad: string; entidad_id: number; fecha_hora: string; detalle: any };
type Diagnostico = {
 id: number;
 codigo_icd10: string;
 descripcion: string;
 es_principal: boolean;
 id_episodio: number;
 fecha_diagnostico: string;
 motivo: string;
};

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
 SESION_AVATAR: SesionAvatar[];
 AUDITORIA: Auditoria[];
 DIAGNOSTICOS: Diagnostico[];
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

/** ===== Estado inicial vacío - se carga desde BD ===== */
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
 SESION_AVATAR: [],
 AUDITORIA: [],
 DIAGNOSTICOS: [],
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

/** ===== Utilidades ===== */
const fmt = (d: string) => new Date(d).toLocaleString();
const combineDiagnosis = (a: string, b: string) => (!a?.trim() ? b || "" : !b?.trim() ? a : `${a}\n\n${b}`);

/** ===== Herramientas IA (simulador) ===== */
type ToolId =
 | "resumen"
 | "expPreDx"
 | "difDx"
 | "redFlags"
 | "labsPlan"
 | "manejo"
 | "hidratacion"
 | "alergiaAbx"
 | "alta"
 | "notaCorta"
 | "expPaciente"
 | "dengueTipos"
 | "labGraph"
 | "ordenes";

type ToolDef = {
 id: ToolId;
 title: string;
 text: string;
 image?: string;
 video?: string;
};

function getToolDefinition(id: ToolId, state: State): ToolDef {
 const nombreCompleto = `${state.PACIENTE.nombre} ${state.PACIENTE.apellido}`;
 const edadTexto = state.PACIENTE.fecha_nacimiento
 ? `Nacida el ${state.PACIENTE.fecha_nacimiento}`
 : "Edad no especificada";

 switch (id) {
 case "resumen":
 return {
 id,
 title: "Resumen estructurado del caso",
 text:
 `Paciente: ${nombreCompleto} (${state.PACIENTE.sexo})\n` +
 `${edadTexto}\n\n` +
 `Motivo de consulta actual:\n` +
 `- ${state.EPISODIO.motivo}\n\n` +
 `Narrativa de la consulta:\n` +
 `${state.CONSULTA.narrativa}\n\n` +
 `Antecedentes relevantes:\n` +
 `- Z88.0 · Alergia a penicilina (riesgo de reacción grave a betalactámicos)\n` +
 `- E10 · Diabetes tipo 1 (mayor riesgo metabólico en cuadros febriles)\n\n` +
 `Impresión global:\n` +
 `Cuadro febril agudo de 48 horas, con mialgias y cefalea, en zona potencialmente endémica de dengue.\n` +
 `Se sospecha dengue clásico sin datos actuales de choque ni sangrado activo.`,
 video: "/videos/1.mp4"
 };
 case "expPreDx":
 return {
 id,
 title: "Explicación del pre-diagnóstico",
 text:
 `Pre-diagnóstico actual:\n` +
 `"${state.AI.preDiagnosis}"\n\n` +
 `Justificación clínica resumida:\n` +
 `1) Fiebre + mialgias + cefalea → patrón típico de dengue clásico.\n` +
 `2) Duración menor a 72 h → fase febril temprana.\n` +
 `3) Ausencia de datos de choque, sangrado activo o deterioro neurológico en la narrativa.\n` +
 `4) Alergia a penicilina → condiciona la elección de antibióticos si se sospechara coinfección bacteriana, ` +
 `pero en este escenario el cuadro es predominantemente viral.\n\n` +
 `Por esto se propone “probable dengue clásico” y se sugiere vigilancia estrecha + laboratorio.`,
 video: "/videos/2-0.mp4"
 };
 case "difDx":
 return {
 id,
 title: "Diagnóstico diferencial del cuadro febril",
 text:
 `Diagnóstico diferencial para ${nombreCompleto}:\n\n` +
 `1) Dengue clásico (A90)\n` +
 ` - Compatible con fiebre aguda, mialgias, cefalea, malestar general.\n\n` +
 `2) Dengue con signos de alarma / dengue grave (A91)\n` +
 ` - Considerar si aparecen dolor abdominal intenso, vómitos persistentes, hipotensión, sangrado.\n\n` +
 `3) Infección viral tipo influenza\n` +
 ` - Fiebre, mialgias y cefalea también son comunes; se diferencian por patrón respiratorio más marcado.\n\n` +
 `4) COVID-19 u otras infecciones respiratorias virales\n` +
 ` - Evaluar si hay tos, disnea, contacto con casos confirmados.\n\n` +
 `5) Infecciones bacterianas (ej. faringoamigdalitis, ITU, etc.)\n` +
 ` - Considerar si hay foco infeccioso claro; aquí el cuadro se describe como más bien sistémico.\n\n` +
 `En un sistema real, la IA sugeriría este diferencial y el médico validaría qué tan probable es cada opción.`,
    video: "/videos/3-1.mp4"
 };
 case "redFlags":
 return {
 id,
 title: "Signos de alarma a vigilar (red flags)",
 text:
 `Signos de alarma para dengue/estado grave que la IA marcaría en rojo:\n\n` +
 `- Dolor abdominal intenso y persistente.\n` +
 `- Vómitos frecuentes o incapacidad para tolerar líquidos.\n` +
 `- Sangrado de encías, nariz o hematomas espontáneos.\n` +
 `- Somnolencia, irritabilidad extrema o confusión.\n` +
 `- Hipotensión, mareos al ponerse de pie, piel fría y pegajosa.\n` +
 `- Disminución marcada en la diuresis (poca orina).\n\n` +
 `Si cualquiera de estos aparece, la recomendación es derivación inmediata a urgencias y reevaluación hemodinámica.`,
    video: "/videos/4-2.mp4"
 };
 case "labsPlan":
 return {
 id,
 title: "Plan de laboratorio sugerido",
 text:
 `Plan de laboratorio para paciente con sospecha de dengue clásico:\n\n` +
 `1) Hemograma completo\n` +
 ` - Vigilar plaquetas, hemoglobina y hematocrito.\n` +
 `2) Pruebas específicas de dengue\n` +
 ` - NS1/IgM según día de evolución y disponibilidad del laboratorio.\n` +
 `3) Química sanguínea básica\n` +
 ` - Glucosa, urea, creatinina, electrólitos.\n` +
 `4) Función hepática (si está disponible)\n` +
 ` - AST, ALT, bilirrubinas.\n\n` +
 `Objetivo de la IA: recordar al médico qué pedir y cómo interpretarlo en conjunto con la clínica, ` +
 `no sustituir el criterio clínico.`
 , video: "/videos/5-3.mp4"
 };
 case "manejo":
 return {
 id,
 title: "Manejo ambulatorio vs. hospitalario",
 text:
 `Propuesta de manejo para ${nombreCompleto}:\n\n` +
 `Manejo ambulatorio (si NO hay signos de alarma):\n` +
 `- Hidratación oral estricta.\n` +
 `- Paracetamol como analgésico/antipirético.\n` +
 `- Evitar AINEs (ibuprofeno, naproxeno, aspirina) por riesgo de sangrado.\n` +
 `- Revisión de glucosa capilar si hay antecedente de diabetes.\n\n` +
 `Criterios para manejo hospitalario:\n` +
 `- Presencia de signos de alarma o choque.\n` +
 `- Imposibilidad de mantener hidratación oral.\n` +
 `- Comorbilidades importantes descompensadas.\n\n` +
 `La IA sólo sugiere; la decisión definitiva la toma el equipo tratante.`,
    video: "/videos/6-4.mp4"
 };
 case "hidratacion":
 return {
 id,
 title: "Recomendaciones de hidratación",
 text:
 `Recomendaciones de hidratación para dengue clásico:\n\n` +
 `- Meta orientativa: 60–80 ml/kg/día de líquidos orales, ajustando según peso y estado clínico.\n` +
 `- Usar soluciones de rehidratación oral o sueros comerciales (evitar bebidas muy azucaradas).\n` +
 `- Fraccionar en tomas pequeñas y frecuentes si hay náusea.\n` +
 `- Reforzar señales de alarma: boca seca, poca orina, mareos.\n\n` +
 `En un sistema real, la IA podría adaptar estos volúmenes de forma personalizada usando el peso registrado del paciente: ` +
 `${state.PACIENTE.peso} kg.`,
    video: "/videos/7-5.mp4"
 };
 case "alergiaAbx":
 return {
 id,
 title: "Manejo de alergia a penicilina",
 text:
 `Alergia conocida: Z88.0 · Alergia a penicilina.\n\n` +
 `Recomendación de la IA:\n` +
 `- Evitar penicilinas y, dependiendo del tipo de reacción, valorar también evitar algunas cefalosporinas.\n` +
 `- Registrar claramente el antecedente en el expediente y en recetas.\n` +
 `- Si se sospecha coinfección bacteriana, sugerir alternativas (ej. macrólidos, quinolonas, etc.) ` +
 `según guías locales y función renal.\n\n` +
 `En este escenario la IA recuerda el riesgo, pero la indicación final (fármaco, dosis, duración) es del médico.`,
    video: "/videos/8-6.mp4"
 };
 case "alta":
 return {
 id,
 title: "Checklist antes del alta",
 text:
 `Checklist antes de dar alta a ${nombreCompleto}:\n\n` +
 `1) Confirmar que NO haya signos de alarma activos.\n` +
 `2) Explicar claramente al paciente:\n` +
 ` - Diagnóstico probable (dengue clásico).\n` +
 ` - Qué síntomas vigilar en casa.\n` +
 `3) Entregar hoja con instrucciones de hidratación y analgésicos permitidos.\n` +
 `4) Programar cita de control o indicar cuándo regresar a urgencias.\n` +
 `5) Registrar todo en el resumen de la nota clínica.\n\n` +
 `La IA actúa como recordatorio estructurado, evitando omitir pasos críticos.`,
    video: "/videos/9-7.mp4"
 };
 case "notaCorta":
 return {
 id,
 title: "Borrador de nota clínica corta",
 text:
 `Borrador de nota :\n\n` +
 `Paciente femenina de ${edadTexto}, con antecedente de alergia a penicilina y diabetes tipo 1, ` +
 `acude por ${state.EPISODIO.motivo.toLowerCase()}.\n` +
 `Refiere ${state.CONSULTA.narrativa.toLowerCase()}\n\n` +
 `A la exploración: TA estable, FC taquicárdica leve, sin sangrado activo, sin datos de choque.\n` +
 `Se sospecha dengue clásico (A90) sin signos de alarma al momento.\n\n` +
 `Plan: solicitar hemograma, pruebas específicas de dengue, hidratación oral y vigilancia estrecha en domicilio ` +
 `con instrucciones claras de signos de alarma.`,
    video: "/videos/10-8.mp4"
 };
 case "expPaciente":
 return {
 id,
 title: "Explicación sencilla para el paciente",
 text:
 `Mensaje en lenguaje sencillo para ${nombreCompleto}:\n\n` +
 `"Por lo que vemos, tienes un cuadro compatible con dengue clásico. Es una infección que da fiebre, ` +
 `dolor de cuerpo y cansancio. Por ahora no vemos datos de gravedad, pero necesitamos vigilarte de cerca.\n\n` +
 `Lo más importante es que tomes muchos líquidos, uses sólo el analgésico que te indicamos y estés atento a ` +
 `signos de alarma como dolor abdominal muy fuerte, sangrado, mareos intensos o dificultad para tomar líquidos.\n\n` +
 `Si alguno de esos aparece, regresa de inmediato al hospital."`,
    video: "/videos/11-9.mp4"
 };
 case "dengueTipos":
 return {
 id,
 title: "Dengue clásico vs dengue hemorrágico",
 text:
 `Dengue clásico (A90):\n` +
 `- Fiebre alta, dolor de cabeza, dolor detrás de los ojos, mialgias y malestar general.\n` +
 `- Puede haber sarpullido leve.\n` +
 `- Generalmente se maneja con hidratación y vigilancia.\n\n` +
 `Dengue hemorrágico / dengue grave (A91):\n` +
 `- Además de los síntomas anteriores, se presentan signos de fuga capilar y sangrados.\n` +
 `- Dolor abdominal intenso, vómitos persistentes, sangrado de mucosas.\n` +
 `- Riesgo de choque y compromiso hemodinámico.\n\n` +
 `La IA puede recordar al médico estos criterios en el momento en que está tomando decisiones, ` +
 `pero la confirmación depende de la valoración clínica y de laboratorio.`,
    video: "/videos/12-10.mp4"
 };
 case "labGraph":
 return {
 id,
 title: "Curva de laboratorio en dengue (imagen)",
 text:"",
 video: "/videos/13-11.mp4",
 image:
 "https://www.researchgate.net/publication/7861230/figure/tbl1/AS:601597239377920@1520443367134/Laboratory-results-of-a-dengue-hemorrhagic-fever-patient-according-to-the-day-of.png"
 };
 case "ordenes":
 return {
 id,
 title: "Órdenes médicas sugeridas",
 text:
 `Ejemplo de órdenes médicas que la IA podría proponer para revisión del médico:\n\n` +
 `- Diagnóstico probable: dengue clásico (A90).\n` +
 `- Laboratorio: hemograma completo, NS1/IgM, química sanguínea básica, función hepática.\n` +
 `- Tratamiento: hidratación oral + paracetamol a dosis ajustada al peso.\n` +
 `- Restricciones: evitar AINEs; registrar alergia a penicilina en orden médica.\n` +
 `- Vigilancia en casa con instrucciones escritas de signos de alarma.\n\n` +
 `Todas estas órdenes son y deben ser validadas/modificadas por el médico antes de aplicarse.`,
    video: "/videos/14-12.mp4"
 };
 default:
 return {
 id: "resumen",
 title: "Función IA",
 text: "Función no definida en este demo."
 };
 }
}

/** ===== Componente principal ===== */
export default function DoctorDashboard() {
 const [state, setState] = useState<State>(getInitialState());
 const [loading, setLoading] = useState(true);
 const [doctorInfo, setDoctorInfo] = useState<{nombre?: string; foto_url?: string; especialidad?: string} | null>(null);
 const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | null>(null);
 const [patients, setPatients] = useState<Array<Record<string, any>>>([]);
 const [activePatientIndex, setActivePatientIndex] = useState(0);
 const [patientLoading, setPatientLoading] = useState(false);
 const [newPatientUsername, setNewPatientUsername] = useState("");
 const [assigningPatient, setAssigningPatient] = useState(false);
 const [unassigningPatient, setUnassigningPatient] = useState(false);
 const [activeTab, setActiveTab] = useState<
 "general" | "consulta" | "episodio" | "archivos" | "avatar" | "auditoria" | "catalogos" | "ai"
 >("general");
 const [searchTerm, setSearchTerm] = useState("");
 const [searchResults, setSearchResults] = useState<Array<Record<string, any>>>([]);
 const [searchOpen, setSearchOpen] = useState(false);
 const [searchLoading, setSearchLoading] = useState(false);
 const searchContainerRef = useRef<HTMLDivElement | null>(null);
 const searchControllerRef = useRef<AbortController | null>(null);

 // Obtener ID del médico desde localStorage
 const [MEDICO_ID, setMEDICO_ID] = useState<number | null>(() => {
   const stored = localStorage.getItem("medico_id");
   return stored ? parseInt(stored, 10) : null;
 });

 const DEFAULT_API = import.meta.env.VITE_API || "http://localhost:8080";
 const DOCTOR_API = import.meta.env.VITE_DOCTOR_API || DEFAULT_API;
 const PATIENT_API = import.meta.env.VITE_PATIENT_API || DEFAULT_API;

 const loadPatientDetails = async (
   patientData: Record<string, any>,
   options: { showSpinner?: boolean } = {}
 ) => {
   const { showSpinner = true } = options;
   if (!patientData || !patientData.id) {
     console.error("No se recibieron datos válidos del paciente");
     toast.error("Paciente no válido para cargar");
     return;
   }

   if (showSpinner) {
     setPatientLoading(true);
   }

   try {
     const patientId = patientData.id;

     let consultations: Array<Record<string, any>> = [];
     try {
      const consultationsResponse = await fetch(`${PATIENT_API}/api/db/patient/${patientId}/consultations`);
       if (consultationsResponse.ok) {
         consultations = await consultationsResponse.json();
       }
     } catch (error) {
       console.warn("Error cargando consultas:", error);
     }

     let files: Array<Record<string, any>> = [];
     try {
      const filesResponse = await fetch(`${PATIENT_API}/api/db/patient/${patientId}/files`);
       if (filesResponse.ok) {
         files = await filesResponse.json();
       }
     } catch (error) {
       console.warn("Error cargando archivos:", error);
     }

     let diagnoses: Array<Record<string, any>> = [];
     try {
      const diagnosesResponse = await fetch(`${PATIENT_API}/api/db/patient/${patientId}/diagnoses`);
       if (diagnosesResponse.ok) {
         diagnoses = await diagnosesResponse.json();
       }
     } catch (error) {
       console.warn("Error cargando diagnósticos:", error);
     }

     // Cargar conversaciones del avatar (últimas 10)
     let avatarConversations: Array<Record<string, any>> = [];
     try {
       console.log(`🔍 Cargando conversaciones para patientId: ${patientId}`);
       const conversationsResult = await api.patient.getConversations(patientId, 10);
       console.log("📦 Resultado de conversaciones:", conversationsResult);
       if (conversationsResult && conversationsResult.conversations) {
         avatarConversations = conversationsResult.conversations;
       } else if (conversationsResult && conversationsResult.items) {
         avatarConversations = conversationsResult.items;
       }
       console.log(`✅ Cargadas ${avatarConversations.length} conversaciones`);
     } catch (error) {
       console.error("❌ Error cargando conversaciones del avatar:", error);
     }

     let photoUrl: string | null = null;
     try {
      const photoResponse = await fetch(`${PATIENT_API}/api/db/patient/${patientId}/photo`);
       if (photoResponse.ok) {
         const photoData = await photoResponse.json();
         photoUrl = photoData.photo_url || null;
       }
     } catch (error) {
       console.warn("Error cargando foto del paciente:", error);
     }

     setPatientPhotoUrl(photoUrl);

     const initial = getInitialState();

     setState((prev) => ({
       ...prev,
       PACIENTE: {
         id: patientData.id || 0,
         usuario_id: patientData.usuario_id || 0,
         nombre: patientData.nombre || "",
         apellido: patientData.apellido || "",
         fecha_nacimiento: patientData.fecha_nacimiento
           ? (typeof patientData.fecha_nacimiento === "string"
               ? patientData.fecha_nacimiento
               : new Date(patientData.fecha_nacimiento).toISOString().split("T")[0])
           : "",
         sexo: patientData.sexo || "",
         altura: patientData.altura?.toString() || "",
         peso: patientData.peso?.toString() || "",
         estilo_vida: patientData.estilo_vida || "",
         id_tipo_sangre: Number(patientData.id_tipo_sangre || patientData.tipo_sangre_id || 0),
         id_ocupacion: Number(patientData.id_ocupacion || patientData.ocupacion_id || 0),
         id_estado_civil: Number(patientData.id_estado_civil || patientData.estado_civil_id || 0),
         id_medico_gen: Number(patientData.id_medico_gen || 0),
         foto_archivo_id: patientData.foto_archivo_id || null,
       },
       CONSULTA:
         consultations.length > 0
           ? {
               id: consultations[0].id || 0,
               cita_id: consultations[0].cita_id || 0,
               id_estado_consulta: consultations[0].id_estado_consulta || 0,
               id_episodio: consultations[0].id_episodio || 0,
               fecha_hora: consultations[0].fecha_hora || "",
               narrativa: consultations[0].narrativa || "",
               mongo_consulta_id: consultations[0].mongo_consulta_id || "",
               diagnostico_final: consultations[0].diagnostico_final || "",
             }
           : initial.CONSULTA,
       ARCHIVO: files.map((f: any) => ({
         id: f.id,
         tipo: f.tipo,
         url: f.url,
         hash_integridad: f.hash_integridad || "",
         creado_en: f.creado_en || "",
       })),
       DIAGNOSTICOS: diagnoses.map((d: any) => ({
         id: d.id,
         codigo_icd10: d.codigo_icd10 || "",
         descripcion: d.descripcion || "",
         es_principal: d.es_principal || false,
         id_episodio: d.id_episodio,
         fecha_diagnostico: d.fecha_diagnostico || "",
         motivo: d.motivo || "",
       })),
     }));

     // Actualizar conversaciones del avatar
     setConversations(avatarConversations.map((conv: any) => {
       // Asegurar que el ID sea un string válido
       let convId = "";
       if (conv.id) {
         convId = String(conv.id);
       } else if (conv._id) {
         convId = String(conv._id);
       }
       
       return {
         id: convId,
         patientId: conv.patientId,
         userId: conv.userId,
         messages: conv.messages || [],
         createdAt: conv.createdAt,
         updatedAt: conv.updatedAt,
         messageCount: conv.messageCount || (conv.messages ? conv.messages.length : 0)
       };
     }));
   } catch (error) {
     console.error("Error cargando datos del paciente:", error);
     toast.error("Error al cargar datos del paciente");
   } finally {
     if (showSpinner) {
       setPatientLoading(false);
     }
   }
 };

 // Cargar datos del doctor al montar
 useEffect(() => {
   // Verificar si hay médico_id en localStorage si no está en el estado
   const storedMedicoId = localStorage.getItem("medico_id");
   if (storedMedicoId && !MEDICO_ID) {
     setMEDICO_ID(parseInt(storedMedicoId, 10));
   }
   
   if (MEDICO_ID) {
     loadDoctorData();
   } else if (!storedMedicoId) {
     console.error("No hay médico_id en localStorage");
     toast.error("No hay médico logueado. Redirigiendo al login...");
     setTimeout(() => {
       window.location.href = "/login";
     }, 2000);
   }
 }, [MEDICO_ID]);

  // Gestionar peticiones de búsqueda de pacientes
  useEffect(() => {
    if (!MEDICO_ID) {
      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
        searchControllerRef.current = null;
      }
      setSearchLoading(false);
      return;
    }

    const term = searchTerm.trim();

    if (!term) {
      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
        searchControllerRef.current = null;
      }
      setSearchLoading(false);
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    if (term.length < 2) {
      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
        searchControllerRef.current = null;
      }
      setSearchLoading(false);
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const controller = new AbortController();
    searchControllerRef.current?.abort();
    searchControllerRef.current = controller;
    setSearchLoading(true);
    setSearchResults([]);
    setSearchOpen(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const matches = await api.doctor.searchPatients(MEDICO_ID, term, { signal: controller.signal });
          if (controller.signal.aborted) {
            return;
          }

          const list = Array.isArray(matches) ? matches : [];
          setSearchResults(list);
          setSearchOpen(true);
        } catch (error: any) {
          if (controller.signal.aborted) {
            return;
          }
          console.error("Error buscando pacientes:", error);
          toast.error("Error buscando pacientes", { id: "doctor-search-error" });
          setSearchResults([]);
          setSearchOpen(false);
        } finally {
          if (!controller.signal.aborted) {
            setSearchLoading(false);
          }
          if (searchControllerRef.current === controller) {
            searchControllerRef.current = null;
          }
        }
      })();
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchTerm, MEDICO_ID]);

  // Cancelar petición de búsqueda al desmontar
  useEffect(() => {
    return () => {
      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
        searchControllerRef.current = null;
      }
    };
  }, []);

  // Cerrar el dropdown de búsqueda al hacer clic fuera
  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!searchContainerRef.current) {
        return;
      }
      if (searchContainerRef.current.contains(event.target as Node)) {
        return;
      }
      setSearchOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchOpen]);

 // Función para cargar datos del doctor
 const loadDoctorData = async () => {
   const medicoId = MEDICO_ID || parseInt(localStorage.getItem("medico_id") || "0", 10);
   if (!medicoId) {
     console.error("No hay MEDICO_ID disponible");
     setLoading(false);
     return;
   }
   
   setLoading(true);
   try {
     console.log(`Cargando datos del doctor con ID: ${medicoId}`);
     
     // Cargar información del doctor
    const response = await fetch(`${DOCTOR_API}/api/db/doctor/${medicoId}`);
     console.log(`Response status: ${response.status}`);
     
     if (response.ok) {
       const doctorData = await response.json();
       console.log("Datos del doctor recibidos:", doctorData);
       setDoctorInfo({
         nombre: `${doctorData.nombre || ""} ${doctorData.apellido || ""}`.trim(),
         foto_url: doctorData.foto_url,
         especialidad: doctorData.especialidad_nombre
       });
     } else {
       const errorText = await response.text();
       console.error(`Error al obtener doctor: ${response.status} - ${errorText}`);
       toast.error(`Error al cargar datos del doctor: ${response.status}`);
     }

      // Cargar pacientes asignados al doctor
      let patientList: Array<Record<string, any>> = [];
      let patientFetchFailed = false;
      try {
        const patientsResponse = await fetch(`${DOCTOR_API}/api/db/doctor/${medicoId}/patients`);
        console.log("Response status pacientes:", patientsResponse.status);

        if (patientsResponse.ok) {
          patientList = await patientsResponse.json();
          console.log("Pacientes recibidos:", patientList);
        } else if (patientsResponse.status !== 404) {
          patientFetchFailed = true;
          const errorText = await patientsResponse.text();
          console.error("Error al obtener pacientes:", patientsResponse.status, errorText);
          toast.error("Error al cargar pacientes");
        }
      } catch (error) {
        console.error("Excepción al cargar pacientes:", error);
        patientFetchFailed = true;
        toast.error("No se pudieron cargar los pacientes del doctor");
      }

      setPatients(patientList);

      if (patientList.length > 0) {
        await loadPatientDetails(patientList[0], { showSpinner: false });
        setActivePatientIndex(0);
      } else {
        if (!patientFetchFailed) {
          toast("No hay pacientes vinculados a este médico");
        }
        setActivePatientIndex(0);
        setPatientPhotoUrl(null);
        setState((prev) => {
          const base = getInitialState();
          return {
            ...base,
            CATALOGOS: prev.CATALOGOS,
          };
        });
      }

     // Cargar catálogos
     try {
      console.log("Intentando cargar catálogos desde:", `${PATIENT_API}/api/db/catalogos`);
      const catalogosResponse = await fetch(`${PATIENT_API}/api/db/catalogos`);
       console.log("Response status:", catalogosResponse.status);
       
       if (catalogosResponse.ok) {
         const catalogos = await catalogosResponse.json();
         console.log("Catálogos recibidos:", catalogos);
         
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
         
         console.log("Catálogos cargados en estado:", {
           TIPO_SANGRE: catalogos.TIPO_SANGRE?.length || 0,
           OCUPACION: catalogos.OCUPACION?.length || 0,
           ESTADO_CIVIL: catalogos.ESTADO_CIVIL?.length || 0,
           MEDICO: catalogos.MEDICO?.length || 0,
         });
       } else {
         const errorText = await catalogosResponse.text();
         console.error("Error al obtener catálogos:", catalogosResponse.status, errorText);
         toast.error("Error al cargar catálogos");
       }
     } catch (error) {
       console.error("Excepción al cargar catálogos:", error);
       toast.error("Error al conectar con el servidor para cargar catálogos");
     }

     toast.success("Datos cargados correctamente");
   } catch (error) {
     console.error("Error cargando datos del doctor:", error);
     toast.error("Error al cargar datos del doctor");
   } finally {
     setLoading(false);
   }
 };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchFocus = () => {
    if (searchTerm.trim().length >= 2) {
      setSearchOpen(true);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (searchTerm) {
        event.preventDefault();
        setSearchTerm("");
      }
      setSearchOpen(false);
      return;
    }

    if (event.key === "Enter" && searchResults.length > 0) {
      event.preventDefault();
      void handleSelectPatientFromSearch(searchResults[0]);
    }
  };

  const handleSelectPatientFromSearch = async (match: Record<string, any>) => {
    if (patientLoading) {
      return;
    }

    if (!match || !match.id) {
      toast.error("Paciente no válido para cargar");
      return;
    }

    searchControllerRef.current?.abort();
    searchControllerRef.current = null;

    setSearchTerm("");
    setSearchOpen(false);
    setSearchResults([]);
    setSearchLoading(false);

    let updatedList = patients;
    let index = patients.findIndex((patient) => patient.id === match.id);

    if (index >= 0) {
      const next = [...patients];
      next[index] = { ...next[index], ...match };
      updatedList = next;
      setPatients(next);
    } else {
      const next = [...patients, match];
      updatedList = next;
      setPatients(next);
      index = next.length - 1;
    }

    if (index < 0) {
      return;
    }

    setActivePatientIndex(index);
    await loadPatientDetails(updatedList[index]);
  };

 const goToPatient = async (index: number) => {
   if (index === activePatientIndex) {
     return;
   }
   if (index < 0 || index >= patients.length) {
     return;
   }
   if (patientLoading) {
     return;
   }

   setActivePatientIndex(index);
   await loadPatientDetails(patients[index]);
 };

 const handlePrevPatient = () => {
   void goToPatient(activePatientIndex - 1);
 };

 const handleNextPatient = () => {
   void goToPatient(activePatientIndex + 1);
 };

 const handleAssignPatient = async () => {
   if (!MEDICO_ID) {
     toast.error("No hay médico seleccionado");
     return;
   }

   const username = newPatientUsername.trim();
   if (!username) {
     toast.error("Ingresa el username del paciente");
     return;
   }

   setAssigningPatient(true);
   try {
    const response = await fetch(`${DOCTOR_API}/api/db/doctor/${MEDICO_ID}/assign-patient`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ username }),
     });

     if (!response.ok) {
       let message = "No se pudo vincular al paciente";
       try {
         const errorData = await response.json();
         if (errorData?.error) {
           message = errorData.error;
         }
       } catch (error) {
         console.warn("No se pudo leer el error de asignación:", error);
       }
       throw new Error(message);
     }

     const data = await response.json();
     const assigned = data?.patient;

     if (!assigned || !assigned.id) {
       throw new Error("La respuesta del servidor no contiene el paciente vinculado");
     }

     let nextIndex = 0;
     setPatients((prevList) => {
       const existingIdx = prevList.findIndex((p: any) => p.id === assigned.id);
       let updated: Array<Record<string, any>>;
       if (existingIdx >= 0) {
         updated = prevList.map((p, idx) => (idx === existingIdx ? assigned : p));
         nextIndex = existingIdx;
       } else {
         updated = [...prevList, assigned];
         nextIndex = updated.length - 1;
       }
       return updated;
     });

     setNewPatientUsername("");
     setActivePatientIndex(nextIndex);
     toast.success("Paciente vinculado correctamente");
     await loadPatientDetails(assigned);
   } catch (error: any) {
     console.error("Error asignando paciente:", error);
     toast.error(error?.message || "Error al vincular paciente");
   } finally {
     setAssigningPatient(false);
   }
 };

 const handleAssignInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
   if (event.key === "Enter") {
     event.preventDefault();
     void handleAssignPatient();
   }
 };

 const handleUnassignPatient = async () => {
   if (!MEDICO_ID) {
     toast.error("No hay médico seleccionado");
     return;
   }

   if (!patients.length) {
     toast.error("No hay paciente seleccionado");
     return;
   }

   const current = patients[activePatientIndex];
   if (!current || !current.id) {
     toast.error("Paciente actual no válido");
     return;
   }

   const confirm = window.confirm("¿Deseas desvincular a este paciente?");
   if (!confirm) {
     return;
   }

   setUnassigningPatient(true);
   try {
    const response = await fetch(`${DOCTOR_API}/api/db/doctor/${MEDICO_ID}/patients/${current.id}`, {
       method: "DELETE",
       headers: { "Content-Type": "application/json" },
     });

     if (!response.ok) {
       let message = "No se pudo desvincular al paciente";
       try {
         const errorData = await response.json();
         if (errorData?.error) {
           message = errorData.error;
         }
       } catch (error) {
         console.warn("No se pudo leer el error de desvinculación:", error);
       }
       throw new Error(message);
     }

    const newList = patients.filter((patient) => patient.id !== current.id);
    setPatients(newList);

    toast.success("Paciente desvinculado");

    if (newList.length > 0) {
      const nextIndex = Math.min(activePatientIndex, newList.length - 1);
      setActivePatientIndex(nextIndex);
      await loadPatientDetails(newList[nextIndex]);
    } else {
      toast("No quedan pacientes vinculados");
      setActivePatientIndex(0);
      setPatientPhotoUrl(null);
      setState((prev) => {
         const base = getInitialState();
         return {
           ...base,
           CATALOGOS: prev.CATALOGOS,
         };
       });
     }
   } catch (error: any) {
     console.error("Error desvinculando paciente:", error);
     toast.error(error?.message || "Error al desvincular paciente");
   } finally {
     setUnassigningPatient(false);
   }
 };

 // ===== Estado para modales IA (pop-ups) =====
 const [activeTool, setActiveTool] = useState<ToolId | null>(null);
 
 // ===== Estado para modal de agregar condición =====
 const [showAddConditionModal, setShowAddConditionModal] = useState(false);
 const [newCondition, setNewCondition] = useState({
   codigo_icd10: "",
   descripcion: "",
   es_principal: false,
   fecha_diagnostico: new Date().toISOString().split('T')[0]
 });
 const [addingCondition, setAddingCondition] = useState(false);

 // ===== Estado para conversaciones del avatar =====
 const [conversations, setConversations] = useState<Array<{
   id: string;
   patientId?: number;
   userId?: number;
   messages: Array<{ role: string; content: string; timestamp?: string }>;
   createdAt?: string;
   updatedAt?: string;
   messageCount?: number;
 }>>([]);
 const [selectedConversation, setSelectedConversation] = useState<{
   id: string;
   summary: string;
   highlights: string[];
 } | null>(null);
 const [loadingSummary, setLoadingSummary] = useState(false);
 const [typedText, setTypedText] = useState("");
 const [isTyping, setIsTyping] = useState(false);
 const [typingPos, setTypingPos] = useState(0);

 const currentTool = useMemo(
 () => (activeTool ? getToolDefinition(activeTool, state) : null),
 [activeTool, state]
 );

 const openTool = (id: ToolId) => {
 setActiveTool(id);
 setTypedText("");
 setTypingPos(0);
 setIsTyping(true);
 };

 const closeTool = () => {
 setActiveTool(null);
 setIsTyping(false);
 };

// efecto de escritura "en tiempo real" - DEBE estar antes de cualquier return condicional
 useEffect(() => {
 if (!currentTool || !isTyping) return;
 const full = currentTool.text;
 if (typingPos >= full.length) {
 setIsTyping(false);
 return;
 }
 const id = setTimeout(() => {
 setTypedText(full.slice(0, typingPos + 2));
 setTypingPos((p) => p + 2);
 }, 18);
 return () => clearTimeout(id);
 }, [currentTool, isTyping, typingPos]);

// Mostrar indicador de carga - DESPUÉS de todos los hooks
if (loading) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(180deg, #0b1220, #0a1730)' }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Cargando datos del doctor...</div>
        <div style={{ fontSize: '14px', color: '#aaa', marginTop: '8px' }}>Por favor espera</div>
      </div>
    </div>
  );
}

// Si no hay MEDICO_ID después de intentar cargar, mostrar error
if (!MEDICO_ID) {
  const storedMedicoId = localStorage.getItem("medico_id");
  if (!storedMedicoId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(180deg, #0b1220, #0a1730)' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>No hay médico logueado</div>
          <div style={{ fontSize: '14px', color: '#aaa', marginTop: '8px' }}>Redirigiendo al login...</div>
        </div>
      </div>
    );
  }
}

 // Función para manejar click en una conversación
 const handleConversationClick = async (conversationId: string) => {
   // Validar que el ID sea un string válido y no esté vacío
   if (!conversationId || conversationId.trim() === "" || conversationId === "{id}") {
     console.error("❌ ID de conversación inválido:", conversationId);
     toast.error("ID de conversación inválido");
     return;
   }
   
   console.log(`🔍 Obteniendo resumen para conversación: ${conversationId}`);
   setLoadingSummary(true);
   try {
     const summaryResult = await api.patient.getConversationSummary(conversationId);
     if (summaryResult) {
       setSelectedConversation({
         id: conversationId,
         summary: summaryResult.summary || "No se pudo generar resumen.",
         highlights: summaryResult.highlights || []
       });
     } else {
       toast.error("No se pudo obtener el resumen de la conversación");
     }
   } catch (error: any) {
     console.error("Error obteniendo resumen:", error);
     toast.error(error?.message || "Error al obtener el resumen de la conversación");
   } finally {
     setLoadingSummary(false);
   }
 };

 // Handlers "Guardar/Imprimir"
 const onSave = async () => {
   if (!state.PACIENTE.id) {
     toast.error("No hay paciente seleccionado");
     return;
   }
   
   try {
     toast.loading("Guardando datos...", { id: "save-toast" });
     
     // Actualizar datos del paciente
    const patientResponse = await fetch(`${PATIENT_API}/api/db/patient/${state.PACIENTE.id}`, {
       method: "PUT",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         nombre: state.PACIENTE.nombre,
         apellido: state.PACIENTE.apellido,
         fecha_nacimiento: state.PACIENTE.fecha_nacimiento,
         sexo: state.PACIENTE.sexo,
         altura: state.PACIENTE.altura,
         peso: state.PACIENTE.peso,
         estilo_vida: state.PACIENTE.estilo_vida,
         id_tipo_sangre: state.PACIENTE.id_tipo_sangre,
         id_ocupacion: state.PACIENTE.id_ocupacion,
         id_estado_civil: state.PACIENTE.id_estado_civil,
         id_medico_gen: state.PACIENTE.id_medico_gen,
       }),
     });
     
     if (!patientResponse.ok) {
       const errorData = await patientResponse.json();
       throw new Error(errorData.error || "Error al actualizar paciente");
     }
     
     // Actualizar consulta si existe
     if (state.CONSULTA.id > 0) {
      const consultationResponse = await fetch(`${PATIENT_API}/api/db/consultation/${state.CONSULTA.id}`, {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           narrativa: state.CONSULTA.narrativa,
           diagnostico_final: state.CONSULTA.diagnostico_final,
         }),
       });
       
       if (!consultationResponse.ok) {
         console.warn("No se pudo actualizar la consulta");
       }
     }
     
    setPatients((prev) =>
      prev.map((patient) =>
        patient.id === state.PACIENTE.id
          ? {
              ...patient,
              nombre: state.PACIENTE.nombre,
              apellido: state.PACIENTE.apellido,
              fecha_nacimiento: state.PACIENTE.fecha_nacimiento,
              sexo: state.PACIENTE.sexo,
              altura: state.PACIENTE.altura ? Number(state.PACIENTE.altura) : null,
              peso: state.PACIENTE.peso ? Number(state.PACIENTE.peso) : null,
              estilo_vida: state.PACIENTE.estilo_vida,
              id_tipo_sangre: state.PACIENTE.id_tipo_sangre,
              id_ocupacion: state.PACIENTE.id_ocupacion,
              id_estado_civil: state.PACIENTE.id_estado_civil,
              id_medico_gen: state.PACIENTE.id_medico_gen,
            }
          : patient
      )
    );

    setSearchResults((prev) =>
      prev.map((patient) =>
        patient.id === state.PACIENTE.id
          ? {
              ...patient,
              nombre: state.PACIENTE.nombre,
              apellido: state.PACIENTE.apellido,
              fecha_nacimiento: state.PACIENTE.fecha_nacimiento,
              sexo: state.PACIENTE.sexo,
              estilo_vida: state.PACIENTE.estilo_vida,
            }
          : patient
      )
    );

    toast.success("Datos guardados correctamente", { id: "save-toast" });
   } catch (error: any) {
     console.error("Error guardando datos:", error);
     toast.error(error.message || "Error al guardar datos", { id: "save-toast" });
   }
 };
 
 const onPrint = () => window.print();

 // Pre-DX → Diagnóstico final
 const useAIasFinal = () =>
 setState((s) => ({ ...s, CONSULTA: { ...s.CONSULTA, diagnostico_final: s.AI.preDiagnosis } }));
 const appendAItoFinal = () =>
 setState((s) => ({
 ...s,
 CONSULTA: { ...s.CONSULTA, diagnostico_final: combineDiagnosis(s.CONSULTA.diagnostico_final, s.AI.preDiagnosis) },
 }));

 // Helpers de seteo de campos (simples)
 const setPaciente = (patch: Partial<State["PACIENTE"]>) =>
 setState((s) => ({ ...s, PACIENTE: { ...s.PACIENTE, ...patch } }));
 const setConsulta = (patch: Partial<State["CONSULTA"]>) =>
 setState((s) => ({ ...s, CONSULTA: { ...s.CONSULTA, ...patch } }));

 const trimmedSearchTerm = searchTerm.trim();
 const shouldShowSearchDropdown = trimmedSearchTerm.length >= 2 && (searchOpen || searchLoading);
 const showSearchEmptyState = shouldShowSearchDropdown && !searchLoading && searchResults.length === 0;

 const hasPatients = patients.length > 0;
 const prevDisabled = patientLoading || patients.length <= 1 || activePatientIndex === 0;
 const nextDisabled =
 patientLoading || patients.length <= 1 || activePatientIndex >= Math.max(patients.length - 1, 0);
 const currentPatientLabel = hasPatients
 ? ([state.PACIENTE.nombre, state.PACIENTE.apellido].filter(Boolean).join(" ") || `Paciente ${activePatientIndex + 1}`)
 : "Sin pacientes";
 const patientCounter = hasPatients && patients.length > 1 ? ` (${activePatientIndex + 1}/${patients.length})` : "";
 const loadingSuffix = patientLoading ? " · cargando..." : "";
 const trimmedAssignUsername = newPatientUsername.trim();
const assignDisabled = assigningPatient || unassigningPatient || patientLoading || !trimmedAssignUsername || !MEDICO_ID;
 const assignButtonLabel = assigningPatient ? "Vinculando..." : "Vincular paciente";
 const removeDisabled =
   unassigningPatient || assigningPatient || patientLoading || !patients.length || !MEDICO_ID;
 const removeButtonLabel = unassigningPatient ? "Desvinculando..." : "Desvincular paciente";

 return (
 <div className="wrap-page">
 {/* ===== Topbar ===== */}
<header className="topbar" role="banner">
<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
  {doctorInfo?.foto_url && (
    <img 
      src={doctorInfo.foto_url} 
      alt={doctorInfo.nombre || "Doctor"}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        objectFit: 'cover',
        border: '2px solid rgba(255, 255, 255, 0.2)'
      }}
    />
  )}
  <div>
    <div className="title">
      {doctorInfo?.nombre || "Doctor Dashboard"}
    </div>
    {doctorInfo?.especialidad && (
      <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
        {doctorInfo.especialidad}
      </div>
    )}
  </div>
</div>
<div
  ref={searchContainerRef}
  style={{
    marginLeft: "auto",
    position: "relative",
    width: "100%",
    maxWidth: 320,
    minWidth: 220,
  }}
>
  <input
    className="search"
    type="search"
    placeholder="Buscar paciente…"
    aria-label="Buscar paciente por nombre o correo"
    value={searchTerm}
    onChange={handleSearchChange}
    onFocus={handleSearchFocus}
    onKeyDown={handleSearchKeyDown}
    autoComplete="off"
  />
  {shouldShowSearchDropdown && (
    <div className="search-dropdown">
      {searchLoading && <div className="search-loading">Buscando…</div>}
      {!searchLoading &&
        searchResults.map((result) => {
          const fullName = [result.nombre, result.apellido].filter(Boolean).join(" ").trim() || `Paciente ${result.id}`;
          let birthLabel: string | null = null;
          if (result.fecha_nacimiento) {
            const parsed = new Date(result.fecha_nacimiento);
            if (!Number.isNaN(parsed.getTime())) {
              birthLabel = `Nac. ${parsed.toLocaleDateString("es-MX")}`;
            }
          }
          const metaParts: string[] = [`ID ${result.id}`];
          if (birthLabel) {
            metaParts.push(birthLabel);
          }
          if (result.correo) {
            metaParts.push(result.correo);
          }

          return (
            <button
              key={result.id}
              type="button"
              className="search-result"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void handleSelectPatientFromSearch(result)}
            >
              <span className="search-result__name">{fullName}</span>
              <span className="search-result__meta">{metaParts.join(" · ")}</span>
            </button>
          );
        })}
      {showSearchEmptyState && <div className="search-empty">Sin coincidencias</div>}
    </div>
  )}
</div>
</header>

 {/* ===== Toolbar ===== */}
 <main className="wrap">
 <div className="toolbar" aria-label="Acciones">
 <button className="btn" onClick={onSave} id="btnSave">
 💾 Guardar
 </button>
 <button className="btn" onClick={onPrint} id="btnPrint">
 🖨️ Imprimir
 </button>
 <div
 style={{
   marginLeft: "auto",
   display: "flex",
   gap: 8,
   alignItems: "center",
   flexWrap: "wrap",
   justifyContent: "flex-end",
 }}
 >
 <input
   type="text"
   value={newPatientUsername}
   onChange={(event) => setNewPatientUsername(event.target.value)}
   onKeyDown={handleAssignInputKeyDown}
   placeholder="Username del paciente"
   aria-label="Username del paciente a vincular"
   style={{
     minWidth: 200,
     padding: "8px 10px",
     borderRadius: 10,
     border: "1px solid var(--card-border)",
     background: "rgba(255,255,255,.06)",
     color: "var(--txt)",
   }}
   disabled={assigningPatient}
 />
 <button
   className="btn"
   type="button"
   onClick={() => void handleAssignPatient()}
   disabled={assignDisabled}
   style={{ minWidth: 160 }}
 >
   {assignButtonLabel}
 </button>
 <button
   className="btn"
   type="button"
   onClick={() => void handleUnassignPatient()}
   disabled={removeDisabled}
   style={{ minWidth: 160 }}
 >
   {removeButtonLabel}
 </button>
 </div>
 </div>

 {/* ===== Card ===== */}
 <section className="card" aria-labelledby="patient-title">
 <div
 className="card-head"
 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
 >
 <h2 id="patient-title">Patient</h2>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <button
 type="button"
 onClick={handlePrevPatient}
 disabled={prevDisabled}
 aria-label="Paciente anterior"
 style={{
 background: "transparent",
 border: "1px solid rgba(255, 255, 255, 0.2)",
 color: "#cfd8ff",
 borderRadius: 6,
 padding: "4px 8px",
 cursor: prevDisabled ? "not-allowed" : "pointer",
 opacity: prevDisabled ? 0.4 : 1,
 transition: "opacity 0.2s ease",
 }}
 >
 ◀
 </button>
 <span style={{ fontSize: 12, color: "#9aa3b5", whiteSpace: "nowrap" }}>
 {`${currentPatientLabel}${patientCounter}${loadingSuffix}`}
 </span>
 <button
 type="button"
 onClick={handleNextPatient}
 disabled={nextDisabled}
 aria-label="Paciente siguiente"
 style={{
 background: "transparent",
 border: "1px solid rgba(255, 255, 255, 0.2)",
 color: "#cfd8ff",
 borderRadius: 6,
 padding: "4px 8px",
 cursor: nextDisabled ? "not-allowed" : "pointer",
 opacity: nextDisabled ? 0.4 : 1,
 transition: "opacity 0.2s ease",
 }}
 >
 ▶
 </button>
 </div>
 </div>

 <div className="card-body">
 {/* ===== patient-row (3 columnas) ===== */}
 <div className="patient-row">
 {/* IZQUIERDA: Identificación + Simulador IA + Pre-DX */}
 <div>
 <div className="field">
 <label>Nombre y Fecha de Nacimiento</label>

 <div className="row-3">
 <input
 data-table="PACIENTE"
 data-column="nombre"
 placeholder="Nombre"
 value={state.PACIENTE.nombre}
 onChange={(e) => setPaciente({ nombre: e.target.value })}
 />
 <input
 data-table="PACIENTE"
 data-column="apellido"
 placeholder="Apellido"
 value={state.PACIENTE.apellido}
 onChange={(e) => setPaciente({ apellido: e.target.value })}
 />
 <input
 data-table="PACIENTE"
 data-column="fecha_nacimiento"
 placeholder="YYYY-MM-DD"
 value={state.PACIENTE.fecha_nacimiento}
 onChange={(e) => setPaciente({ fecha_nacimiento: e.target.value })}
 />
 </div>

 <div className="row-4">
 <div className="field">
 <label>Sexo</label>
 <select
 data-table="PACIENTE"
 data-column="sexo"
 value={state.PACIENTE.sexo}
 onChange={(e) => setPaciente({ sexo: e.target.value })}
 >
 <option>Female</option>
 <option>Male</option>
 <option>Other</option>
 </select>
 </div>

 <div className="field">
 <label>Altura (cm)</label>
 <input
 data-table="PACIENTE"
 data-column="altura"
 value={state.PACIENTE.altura}
 onChange={(e) => setPaciente({ altura: e.target.value })}
 />
 </div>

 <div className="field">
 <label>Peso (kg)</label>
 <input
 data-table="PACIENTE"
 data-column="peso"
 value={state.PACIENTE.peso}
 onChange={(e) => setPaciente({ peso: e.target.value })}
 />
 </div>

 <div className="field">
 <label>Estilo de vida</label>
 <input
 data-table="PACIENTE"
 data-column="estilo_vida"
 value={state.PACIENTE.estilo_vida}
 onChange={(e) => setPaciente({ estilo_vida: e.target.value })}
 />
 </div>
 </div>

 <div className="row-4">
 <div className="field">
 <label>Tipo sangre</label>
 <select
 id="selTipoSangre"
 value={state.PACIENTE.id_tipo_sangre ? String(state.PACIENTE.id_tipo_sangre) : ""}
 onChange={(e) => setPaciente({ id_tipo_sangre: Number(e.target.value) || 0 })}
 >
 <option value="">Seleccionar...</option>
 {state.CATALOGOS.TIPO_SANGRE.length > 0 ? (
   state.CATALOGOS.TIPO_SANGRE.map((o) => (
     <option key={o.id} value={String(o.id)}>
 {o.nombre}
 </option>
   ))
 ) : (
   <option disabled>Cargando...</option>
 )}
 </select>
 </div>

 <div className="field">
 <label>Ocupación</label>
 <select
 id="selOcupacion"
 value={state.PACIENTE.id_ocupacion ? String(state.PACIENTE.id_ocupacion) : ""}
 onChange={(e) => setPaciente({ id_ocupacion: Number(e.target.value) || 0 })}
 >
 <option value="">Seleccionar...</option>
 {state.CATALOGOS.OCUPACION.length > 0 ? (
   state.CATALOGOS.OCUPACION.map((o) => (
     <option key={o.id} value={String(o.id)}>
 {o.nombre}
 </option>
   ))
 ) : (
   <option disabled>Cargando...</option>
 )}
 </select>
 </div>

 <div className="field">
 <label>Estado civil</label>
 <select
 id="selEstadoCivil"
 value={state.PACIENTE.id_estado_civil ? String(state.PACIENTE.id_estado_civil) : ""}
 onChange={(e) => setPaciente({ id_estado_civil: Number(e.target.value) || 0 })}
 >
 <option value="">Seleccionar...</option>
 {state.CATALOGOS.ESTADO_CIVIL.length > 0 ? (
   state.CATALOGOS.ESTADO_CIVIL.map((o) => (
     <option key={o.id} value={String(o.id)}>
 {o.nombre}
 </option>
   ))
 ) : (
   <option disabled>Cargando...</option>
 )}
 </select>
 </div>

 <div className="field">
 <label>Médico general</label>
 <select
 id="selMedico"
 value={state.PACIENTE.id_medico_gen ? String(state.PACIENTE.id_medico_gen) : ""}
 onChange={(e) => setPaciente({ id_medico_gen: Number(e.target.value) || 0 })}
 >
 <option value="">Seleccionar...</option>
 {state.CATALOGOS.MEDICO.length > 0 ? (
   state.CATALOGOS.MEDICO.map((o) => (
     <option key={o.id} value={String(o.id)}>
 {o.nombre}
 </option>
   ))
 ) : (
   <option disabled>Cargando...</option>
 )}
 </select>
 </div>
 </div>
 </div>

 {/* Simulador IA con pop-ups */}
 <div className="subcard" style={{ marginTop: 18 }}>
 <h3>AI Med-Assistant</h3>
 <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
 Estas son las preguntas que encontré relevante para que puedas hacerme sobre el pre-diagnóstico dado.
 </p>
 <div className="tool-grid">
 <button className="btn-ghost" onClick={() => openTool("resumen")}>
 1. Resumen estructurado del caso
 </button>
 <button className="btn-ghost" onClick={() => openTool("expPreDx")}>
 2. Explicación del pre-dx IA
 </button>
 <button className="btn-ghost" onClick={() => openTool("difDx")}>
 3. Diagnóstico diferencial
 </button>
 <button className="btn-ghost" onClick={() => openTool("redFlags")}>
 4. Signos de alarma (red flags)
 </button>
 <button className="btn-ghost" onClick={() => openTool("labsPlan")}>
 5. Plan de laboratorio sugerido
 </button>
 <button className="btn-ghost" onClick={() => openTool("manejo")}>
 6. Manejo ambulatorio vs hospitalario
 </button>
 <button className="btn-ghost" onClick={() => openTool("hidratacion")}>
 7. Recs de hidratación
 </button>
 <button className="btn-ghost" onClick={() => openTool("alergiaAbx")}>
 8. Alergia a penicilina
 </button>
 <button className="btn-ghost" onClick={() => openTool("alta")}>
 9. Checklist de alta
 </button>
 <button className="btn-ghost" onClick={() => openTool("notaCorta")}>
 10. Borrador de nota clínica
 </button>
 <button className="btn-ghost" onClick={() => openTool("expPaciente")}>
 11. Explicación para el paciente
 </button>
 <button className="btn-ghost" onClick={() => openTool("dengueTipos")}>
 12. Dengue clásico vs grave
 </button>
 <button className="btn-ghost" onClick={() => openTool("labGraph")}>
 13. Ver curva de laboratorio (imagen)
 </button>
 <button className="btn-ghost" onClick={() => openTool("ordenes")}>
 14. Órdenes médicas sugeridas
 </button>
 </div>
 </div>

 {/* Pre-diagnóstico IA (a lo ancho) */}
 <div className="preDxFull ai-box">
 <div>
 <b>Pre-diagnóstico (IA)</b>
 </div>
 <div className="muted" id="preDxText">
 {state.AI.preDiagnosis}
 </div>
 <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
 <button className="btn" id="btnUseAI" onClick={useAIasFinal}>
 Usar como diagnóstico
 </button>
 <button className="btn" id="btnAppendAI" onClick={appendAItoFinal}>
 Agregar al diagnóstico
 </button>
 </div>
 </div>
 </div>

 {/* COLUMNA CENTRAL (debajo de la foto) */}
 <div className="span-under-photo">
 <div className="field">
 <label style={{ marginTop: 10 as number }}>Diagnóstico final del médico</label>
 <textarea
 data-table="CONSULTA"
 data-column="diagnostico_final"
 id="txtDxFinal"
 placeholder="Diagnóstico definitivo…"
 style={{ minHeight: "442px" }} 
 value={state.CONSULTA.diagnostico_final}
 onChange={(e) => setConsulta({ diagnostico_final: e.target.value })}
 />
 </div>
 </div>

 {/* FOTO fija derecha */}
 <div className="photoCell">
 <div className="photo" aria-label="Foto de paciente">
 <img
 id="fotoPaciente"
 alt="Paciente"
 src={patientPhotoUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23ddd' width='200' height='200'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='18' dy='10.5' font-weight='bold' x='50%25' y='50%25' text-anchor='middle'%3ESin foto%3C/text%3E%3C/svg%3E"}
 onError={(e) => {
   (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23ddd' width='200' height='200'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='18' dy='10.5' font-weight='bold' x='50%25' y='50%25' text-anchor='middle'%3ESin foto%3C/text%3E%3C/svg%3E";
 }}
 />
 </div>
 </div>
 </div>
 {/* /patient-row */}

 {/* ===== TABS ===== */}
 <div className="tabs" role="tablist" style={{ marginTop: 18 }}>
 <div className="tablist" id="tabs">
 {([
 ["general", "General Info"],
 ["consulta", "Consulta"],
 ["episodio", "Episodio"],
 ["archivos", "Archivos"],
 ["avatar", "Avatar/Sesiones"],
 ["auditoria", "Auditoría"],
 ["catalogos", "Catálogos"],
 ["ai", "AI Insights"],
 ] as const).map(([id, label]) => (
 <button
 key={id}
 className={`tab ${activeTab === id ? "" : ""}`}
 aria-selected={activeTab === id}
 data-tab={id}
 onClick={() => setActiveTab(id as any)}
 >
 {label}
 </button>
 ))}
 </div>

 {/* GENERAL */}
 <div className={`tabpanel ${activeTab === "general" ? "active" : ""}`} id="tab-general">
 <div className="grid-2">
 <div className="subcard">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
   <h3 style={{ margin: 0 }}>Condiciones</h3>
   <button
     onClick={() => setShowAddConditionModal(true)}
     style={{
       padding: '6px 12px',
       background: '#52e5ff',
       color: '#0b1220',
       border: 'none',
       borderRadius: '4px',
       cursor: 'pointer',
       fontSize: '13px',
       fontWeight: '500'
     }}
   >
     + Agregar condición
   </button>
 </div>
 {state.DIAGNOSTICOS.length > 0 ? (
   <table className="table" aria-label="Tabla de condiciones">
     <thead>
       <tr>
         <th>Condition</th>
         <th>Status</th>
         <th>Severity</th>
         <th>Fecha Dx</th>
       </tr>
     </thead>
     <tbody id="tbodyCondiciones">
       {state.DIAGNOSTICOS.map((diagnostico) => {
         // Determinar status basado en fecha y si es principal
         const fechaDx = diagnostico.fecha_diagnostico ? new Date(diagnostico.fecha_diagnostico) : null;
         const hoy = new Date();
         const diasDesdeDx = fechaDx ? Math.floor((hoy.getTime() - fechaDx.getTime()) / (1000 * 60 * 60 * 24)) : null;
         
         // Determinar status: chronic (>90 días), active (30-90 días), acute (<30 días), unchanged (sin fecha o muy antiguo)
         let status = "unknown";
         const codigo = diagnostico.codigo_icd10?.toUpperCase() || "";
         
         if (fechaDx && diasDesdeDx !== null) {
           if (diasDesdeDx < 30) {
             status = "acute";
           } else if (diasDesdeDx <= 90) {
             status = diagnostico.es_principal ? "active" : "unchanged";
           } else {
             // Códigos Z (factores de riesgo) y E (endocrinos) suelen ser crónicos
             if (codigo.startsWith("Z") || codigo.startsWith("E")) {
               status = "chronic";
             } else {
               status = diagnostico.es_principal ? "chronic" : "unchanged";
             }
           }
         } else {
           status = diagnostico.es_principal ? "active" : "unchanged";
         }
         
         // Determinar severity basado en el código ICD10 y tipo de condición
         let severity = "Mild";
         if (codigo.startsWith("Z")) {
           // Factores de riesgo - generalmente Mild, pero alergias pueden ser Severe
           severity = codigo.includes("88") || codigo.includes("91") ? "Severe" : "Mild";
         } else if (codigo.startsWith("E")) {
           // Endocrinos - Moderate si es principal
           severity = diagnostico.es_principal ? "Moderate" : "Mild";
         } else if (codigo.startsWith("A") || codigo.startsWith("B")) {
           // Infecciosas - Moderate si es principal, Mild si no
           severity = diagnostico.es_principal ? "Moderate" : "Mild";
         } else if (codigo.startsWith("I") || codigo.startsWith("J")) {
           // Cardiovasculares y respiratorias - generalmente Severe
           severity = "Severe";
         } else if (codigo.startsWith("C")) {
           // Neoplasias - Severe
           severity = "Severe";
         } else {
           severity = diagnostico.es_principal ? "Moderate" : "Mild";
         }
         
         return (
           <tr key={diagnostico.id}>
             <td>
               {diagnostico.codigo_icd10 ? `${diagnostico.codigo_icd10} · ` : ""}
               {diagnostico.descripcion || diagnostico.motivo || "Sin descripción"}
             </td>
             <td className="muted">{status}</td>
             <td>{severity}</td>
             <td>
               {fechaDx 
                 ? fechaDx.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })
                 : "—"}
             </td>
           </tr>
         );
       })}
     </tbody>
   </table>
 ) : (
   <div className="muted" style={{ padding: '16px', textAlign: 'center' }}>
     No hay condiciones registradas para este paciente
   </div>
 )}
 </div>

 <div className="subcard">
 <h3>Notas rápidas</h3>
 <textarea id="txtNotes" placeholder="Evolución, observaciones, laboratorios, etc." />
 <div className="muted" style={{ marginTop: 8 }}>
   {state.CATALOGOS.MEDICO.find((x) => x.id === state.PACIENTE.id_medico_gen)?.nombre 
     ? `GP: ${state.CATALOGOS.MEDICO.find((x) => x.id === state.PACIENTE.id_medico_gen)?.nombre}`
     : "GP: No asignado"}
   {state.PACIENTE.nombre || state.PACIENTE.apellido 
     ? ` · Paciente: ${state.PACIENTE.nombre} ${state.PACIENTE.apellido}`.trim()
     : ""}
   {state.PACIENTE.id_tipo_sangre && state.CATALOGOS.TIPO_SANGRE.find((x) => x.id === state.PACIENTE.id_tipo_sangre)
     ? ` · Tipo sangre: ${state.CATALOGOS.TIPO_SANGRE.find((x) => x.id === state.PACIENTE.id_tipo_sangre)?.nombre}`
     : ""}
 </div>
 </div>
 </div>

 <div className="facts" id="facts">
 <div className="fact">
 <b>PACIENTE.id</b>
 {state.PACIENTE.id}
 </div>
 <div className="fact">
 <b>Usuario</b>
 {state.PACIENTE.usuario_id}
 </div>
 <div className="fact">
 <b>Tipo sangre</b>
 {state.CATALOGOS.TIPO_SANGRE.find((x) => x.id === state.PACIENTE.id_tipo_sangre)?.nombre}
 </div>
 <div className="fact">
 <b>Ocupación</b>
 {state.CATALOGOS.OCUPACION.find((x) => x.id === state.PACIENTE.id_ocupacion)?.nombre}
 </div>
 <div className="fact">
 <b>Estado civil</b>
 {state.CATALOGOS.ESTADO_CIVIL.find((x) => x.id === state.PACIENTE.id_estado_civil)?.nombre}
 </div>
 <div className="fact">
 <b>Médico</b>
 {state.CATALOGOS.MEDICO.find((x) => x.id === state.PACIENTE.id_medico_gen)?.nombre}
 </div>
 </div>
 </div>

 {/* CONSULTA */}
 <div className={`tabpanel ${activeTab === "consulta" ? "active" : ""}`} id="tab-consulta">
 <div className="grid-2">
 <div className="subcard">
 <h3>CONSULTA</h3>
 <div className="row-3">
 <div className="field">
 <label>cita_id</label>
 <input
 data-table="CONSULTA"
 data-column="cita_id"
 value={state.CONSULTA.cita_id}
 onChange={(e) => setConsulta({ cita_id: Number(e.target.value) || 0 })}
 />
 </div>
 <div className="field">
 <label>fecha_hora</label>
 <input
 data-table="CONSULTA"
 data-column="fecha_hora"
 value={state.CONSULTA.fecha_hora}
 onChange={(e) => setConsulta({ fecha_hora: e.target.value })}
 />
 </div>
 <div className="field">
 <label>mongo_consulta_id</label>
 <input
 data-table="CONSULTA"
 data-column="mongo_consulta_id"
 value={state.CONSULTA.mongo_consulta_id}
 onChange={(e) => setConsulta({ mongo_consulta_id: e.target.value })}
 />
 </div>
 </div>

 <div className="row-3" style={{ marginTop: 10 }}>
 <div className="field">
 <label>estado</label>
 <select
 data-table="CONSULTA"
 data-column="id_estado_consulta"
 id="selEstadoConsulta"
 value={state.CONSULTA.id_estado_consulta}
 onChange={(e) => setConsulta({ id_estado_consulta: Number(e.target.value) })}
 >
 {state.CATALOGOS.ESTADO_CONSULTA.map((o) => (
 <option key={o.id} value={o.id}>
 {o.nombre}
 </option>
 ))}
 </select>
 </div>
 <div className="field">
 <label>id_episodio</label>
 <input
 data-table="CONSULTA"
 data-column="id_episodio"
 value={state.CONSULTA.id_episodio}
 onChange={(e) => setConsulta({ id_episodio: Number(e.target.value) || 0 })}
 />
 </div>
 </div>

 <label style={{ marginTop: 10 as number }}>Narrativa</label>
 <textarea
 data-table="CONSULTA"
 data-column="narrativa"
 value={state.CONSULTA.narrativa}
 onChange={(e) => setConsulta({ narrativa: e.target.value })}
 />
 </div>

 <div className="subcard">
 <h3>INTERPRETACION_ARCHIVO</h3>
 <table className="table" id="tblInterpretaciones">
 <thead>
 <tr>
 <th>archivo_id</th>
 <th>fuente</th>
 <th>resultado</th>
 <th>fecha</th>
 </tr>
 </thead>
 <tbody>
 {state.INTERPRETACION_ARCHIVO.map((r) => (
 <tr key={`${r.id}`}>
 <td>{r.id_archivo}</td>
 <td>{r.fuente}</td>
 <td>{r.resultado}</td>
 <td>{fmt(r.fecha)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>

 {/* EPISODIO */}
 <div className={`tabpanel ${activeTab === "episodio" ? "active" : ""}`} id="tab-episodio">
 <div className="subcard">
 <h3>EPISODIO</h3>
 <div className="row-3">
 <div className="field">
 <label>fecha_inicio</label>
 <input
 data-table="EPISODIO"
 data-column="fecha_inicio"
 value={state.EPISODIO.fecha_inicio}
 onChange={(e) =>
 setState((s) => ({ ...s, EPISODIO: { ...s.EPISODIO, fecha_inicio: e.target.value } }))
 }
 />
 </div>
 <div className="field">
 <label>fecha_fin</label>
 <input
 data-table="EPISODIO"
 data-column="fecha_fin"
 value={state.EPISODIO.fecha_fin}
 onChange={(e) =>
 setState((s) => ({ ...s, EPISODIO: { ...s.EPISODIO, fecha_fin: e.target.value } }))
 }
 />
 </div>
 <div className="field">
 <label>motivo</label>
 <input
 data-table="EPISODIO"
 data-column="motivo"
 value={state.EPISODIO.motivo}
 onChange={(e) =>
 setState((s) => ({ ...s, EPISODIO: { ...s.EPISODIO, motivo: e.target.value } }))
 }
 />
 </div>
 </div>
 </div>
 </div>

 {/* ARCHIVOS */}
 <div className={`tabpanel ${activeTab === "archivos" ? "active" : ""}`} id="tab-archivos">
 <div className="subcard">
 <h3>ARCHIVO</h3>
 <table className="table" id="tblArchivos">
 <thead>
 <tr>
 <th>id</th>
 <th>tipo</th>
 <th>url</th>
 <th>hash</th>
 <th>creado_en</th>
 </tr>
 </thead>
 <tbody>
 {state.ARCHIVO.map((a) => (
 <tr key={a.id}>
 <td>{a.id}</td>
 <td>{a.tipo}</td>
 <td>{a.url}</td>
 <td>{a.hash_integridad}</td>
 <td>{fmt(a.creado_en)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="subcard" style={{ marginTop: 12 }}>
 <h3>ARCHIVO_ASOCIACION</h3>
 <table className="table" id="tblArchivoAsoc">
 <thead>
 <tr>
 <th>id</th>
 <th>archivo_id</th>
 <th>entidad</th>
 <th>entidad_id</th>
 <th>descripcion</th>
 <th>creado_por</th>
 <th>fecha</th>
 </tr>
 </thead>
 <tbody>
 {state.ARCHIVO_ASOCIACION.map((r) => (
 <tr key={r.id}>
 <td>{r.id}</td>
 <td>{r.archivo_id}</td>
 <td>{r.entidad}</td>
 <td>{r.entidad_id}</td>
 <td>{r.descripcion}</td>
 <td>{r.creado_por_usuario_id}</td>
 <td>{fmt(r.fecha_creacion)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* AVATAR / CLÍNICA */}
 <div className={`tabpanel ${activeTab === "avatar" ? "active" : ""}`} id="tab-avatar">
 <div className="subcard">
 <h3>Sesiones con el Avatar (Últimas {conversations.length})</h3>
 {conversations.length > 0 ? (
   <table className="table" id="tblSesiones">
     <thead>
       <tr>
         <th>Fecha</th>
         <th>Mensajes</th>
         <th>Última actualización</th>
       </tr>
     </thead>
     <tbody>
       {conversations.map((conv) => {
         const date = conv.updatedAt || conv.createdAt;
         const dateObj = date ? new Date(date) : null;
         return (
           <tr 
             key={conv.id}
             onClick={() => handleConversationClick(conv.id)}
             style={{
               cursor: 'pointer',
               transition: 'background-color 0.2s'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = '#1f2a3e';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = 'transparent';
             }}
           >
             <td>
               {dateObj 
                 ? dateObj.toLocaleDateString('es-ES', { 
                     year: 'numeric', 
                     month: '2-digit', 
                     day: '2-digit',
                     hour: '2-digit',
                     minute: '2-digit'
                   })
                 : "—"}
             </td>
             <td>{conv.messageCount || conv.messages?.length || 0}</td>
             <td>
               {dateObj 
                 ? dateObj.toLocaleDateString('es-ES', { 
                     year: 'numeric', 
                     month: '2-digit', 
                     day: '2-digit',
                     hour: '2-digit',
                     minute: '2-digit'
                   })
                 : "—"}
             </td>
           </tr>
         );
       })}
     </tbody>
   </table>
 ) : (
   <div className="muted" style={{ padding: '16px', textAlign: 'center' }}>
     No hay sesiones registradas con el avatar para este paciente
   </div>
 )}
 </div>

 {/* Modal para mostrar resumen de conversación */}
 {selectedConversation && (
   <div
     style={{
       position: 'fixed',
       top: 0,
       left: 0,
       right: 0,
       bottom: 0,
       background: 'rgba(0, 0, 0, 0.6)',
       display: 'flex',
       justifyContent: 'center',
       alignItems: 'center',
       zIndex: 10000
     }}
     onClick={() => setSelectedConversation(null)}
   >
     <div
       style={{
         background: '#1a2236',
         padding: '24px',
         borderRadius: '8px',
         width: '90%',
         maxWidth: '600px',
         maxHeight: '80vh',
         overflowY: 'auto',
         border: '1px solid #344'
       }}
       onClick={(e) => e.stopPropagation()}
     >
       <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#fff' }}>
         Resumen de Sesión
       </h3>
       
       <div style={{ marginBottom: '20px' }}>
         <h4 style={{ color: '#52e5ff', marginBottom: '10px', fontSize: '16px' }}>
           Resumen
         </h4>
         <p style={{ color: '#ccc', lineHeight: '1.6', fontSize: '14px' }}>
           {selectedConversation.summary}
         </p>
       </div>

       {selectedConversation.highlights.length > 0 && (
         <div>
           <h4 style={{ color: '#52e5ff', marginBottom: '10px', fontSize: '16px' }}>
             Puntos Destacados
           </h4>
           <ul style={{ color: '#ccc', lineHeight: '1.8', fontSize: '14px', paddingLeft: '20px' }}>
             {selectedConversation.highlights.map((highlight, index) => (
               <li key={index} style={{ marginBottom: '8px' }}>
                 {highlight}
               </li>
             ))}
           </ul>
         </div>
       )}

       <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
         <button
           onClick={() => setSelectedConversation(null)}
           style={{
             padding: '8px 16px',
             background: '#52e5ff',
             border: 'none',
             borderRadius: '4px',
             color: '#0b1220',
             cursor: 'pointer',
             fontSize: '14px',
             fontWeight: '500'
           }}
         >
           Cerrar
         </button>
       </div>
     </div>
   </div>
 )}

 <div className="subcard" style={{ marginTop: 12 }}>
 <h3>CLINICA</h3>
 <div className="row-3">
 <div className="field">
 <label>Nombre</label>
 <input
 data-table="CLINICA"
 data-column="nombre"
 value={state.CLINICA.nombre}
 onChange={(e) => setState((s) => ({ ...s, CLINICA: { ...s.CLINICA, nombre: e.target.value } }))}
 />
 </div>
 <div className="field">
 <label>Teléfono</label>
 <input
 data-table="CLINICA"
 data-column="telefono"
 value={state.CLINICA.telefono}
 onChange={(e) =>
 setState((s) => ({ ...s, CLINICA: { ...s.CLINICA, telefono: e.target.value } }))
 }
 />
 </div>
 <div className="field">
 <label>Correo</label>
 <input
 data-table="CLINICA"
 data-column="correo"
 value={state.CLINICA.correo}
 onChange={(e) => setState((s) => ({ ...s, CLINICA: { ...s.CLINICA, correo: e.target.value } }))}
 />
 </div>
 </div>
 </div>
 </div>

 {/* AUDITORÍA */}
 <div className={`tabpanel ${activeTab === "auditoria" ? "active" : ""}`} id="tab-auditoria">
 <div className="subcard">
 <h3>AUDITORIA</h3>
 <table className="table" id="tblAuditoria">
 <thead>
 <tr>
 <th>id</th>
 <th>usuario_id</th>
 <th>accion</th>
 <th>entidad</th>
 <th>entidad_id</th>
 <th>fecha_hora</th>
 <th>detalle</th>
 </tr>
 </thead>
 <tbody>
 {state.AUDITORIA.map((a) => (
 <tr key={a.id}>
 <td>{a.id}</td>
 <td>{a.usuario_id}</td>
 <td>{a.accion}</td>
 <td>{a.entidad}</td>
 <td>{a.entidad_id}</td>
 <td>{fmt(a.fecha_hora)}</td>
 <td>
 <code>{JSON.stringify(a.detalle)}</code>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* CATÁLOGOS */}
 <div className={`tabpanel ${activeTab === "catalogos" ? "active" : ""}`} id="tab-catalogos">
 <div className="grid-2">
 <div className="subcard">
 <h3>ESTADO_CITA</h3>
 <ul id="ulEstadoCita">
 {state.CATALOGOS.ESTADO_CITA.map((x) => (
 <li key={x.id}>
 {x.id} — {x.nombre}
 </li>
 ))}
 </ul>
 </div>
 <div className="subcard">
 <h3>TIPO_CITA</h3>
 <ul id="ulTipoCita">
 {state.CATALOGOS.TIPO_CITA.map((x) => (
 <li key={x.id}>
 {x.id} — {x.nombre}
 </li>
 ))}
 </ul>
 </div>
 </div>

 <div className="grid-2" style={{ marginTop: 12 }}>
 <div className="subcard">
 <h3>ESTADO_CONSULTA</h3>
 <ul id="ulEstadoConsulta">
 {state.CATALOGOS.ESTADO_CONSULTA.map((x) => (
 <li key={x.id}>
 {x.id} — {x.nombre}
 </li>
 ))}
 </ul>
 </div>
 <div className="subcard">
 <h3>TIPO_SANGRE / OCUPACION / ESTADO_CIVIL</h3>
 <div className="row-3">
 <div>
 <b>TIPO_SANGRE</b>
 <ul id="ulTipoSangre">
 {state.CATALOGOS.TIPO_SANGRE.map((x) => (
 <li key={x.id}>
 {x.id} — {x.nombre}
 </li>
 ))}
 </ul>
 </div>
 <div>
 <b>OCUPACION</b>
 <ul id="ulOcupacion">
 {state.CATALOGOS.OCUPACION.map((x) => (
 <li key={x.id}>
 {x.id} — {x.nombre}
 </li>
 ))}
 </ul>
 </div>
 <div>
 <b>ESTADO_CIVIL</b>
 <ul id="ulEstadoCivil">
 {state.CATALOGOS.ESTADO_CIVIL.map((x) => (
 <li key={x.id}>
 {x.id} — {x.nombre}
 </li>
 ))}
 </ul>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* AI INSIGHTS */}
 <div className={`tabpanel ${activeTab === "ai" ? "active" : ""}`} id="tab-ai">
 <div className="grid-2">
 <div className="subcard">
 <h3>Resumen de síntomas (IA)</h3>
 <ul className="muted" id="ulSymptoms">
 {state.AI.symptoms.map((s, i) => (
 <li key={i}>{s}</li>
 ))}
 </ul>

 <h3 style={{ marginTop: 14 as number }}>Condiciones del Paciente (ICD-10)</h3>
 {state.DIAGNOSTICOS.length > 0 ? (
 <div className="muted" id="dxICD10">
     <table className="table" style={{ fontSize: '12px', marginTop: '8px' }}>
       <thead>
         <tr>
           <th>Código</th>
           <th>Descripción</th>
           <th>Fecha</th>
           <th>Principal</th>
         </tr>
       </thead>
       <tbody>
         {state.DIAGNOSTICOS.map((d) => (
           <tr key={d.id}>
             <td><strong>{d.codigo_icd10 || "—"}</strong></td>
             <td>{d.descripcion || "—"}</td>
             <td>{d.fecha_diagnostico ? new Date(d.fecha_diagnostico).toLocaleDateString('es-ES') : "—"}</td>
             <td>{d.es_principal ? "✓" : ""}</td>
           </tr>
         ))}
       </tbody>
     </table>
 </div>
 ) : (
   <div className="muted" id="dxICD10">
     {state.AI.suggestedICD10.length > 0 
       ? state.AI.suggestedICD10.join(", ")
       : "No hay diagnósticos registrados"}
   </div>
 )}

 <h3 style={{ marginTop: 14 as number }}>Pasos siguientes</h3>
 <ul className="muted" id="ulNextSteps">
 {state.AI.nextSteps.map((s, i) => (
 <li key={i}>{s}</li>
 ))}
 </ul>

 <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
 <button className="btn" id="btnAIToFinal" onClick={useAIasFinal}>
 Usar pre-diagnóstico
 </button>
 <button className="btn" id="btnAIAppend" onClick={appendAItoFinal}>
 Agregar al diagnóstico
 </button>
 </div>
 </div>

 <div className="subcard">
 <h3>Riesgos estimados</h3>
 <table className="table" id="tblRisks">
 <thead>
 <tr>
 <th>Riesgo</th>
 <th>Prob.</th>
 </tr>
 </thead>
 <tbody>
 {state.AI.risks.map((r, i) => (
 <tr key={i}>
 <td>{r.name}</td>
 <td>{Math.round(r.score * 100)}%</td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="muted" style={{ marginTop: 8 }}>
 Valores orientativos. Confirmar con laboratorio y juicio clínico.
 </div>
 </div>
 </div>
 </div>
 </div>
 {/* /TABS */}
 </div>
 </section>
 </main>

 {/* ===== MODAL IA (POP-UP) ===== */}
 {currentTool && (
 <div className="modal-backdrop" onClick={closeTool}>
 <div className="modal" onClick={(e) => e.stopPropagation()}>
 <div className="modal-header">
 <h3>{currentTool.title}</h3>
 <button className="modal-close" onClick={closeTool} aria-label="Cerrar">
 ✕
 </button>
 </div>
 <div className="modal-body" style={{ display: "flex", gap: "18px" }}>
  {/* === COLUMNA IZQUIERDA (TEXTO) === */}
  <div style={{ flex: 1, minWidth: 0 }}>
    {/* Mostrar typing block solo si hay texto */}
{currentTool.text?.trim() !== "" && (
  <div className="typing-block">
    {typedText || " "}
    {isTyping && <span className="caret">▌</span>}
  </div>
)}

  </div>

  {/* === COLUMNA DERECHA (VIDEO + IMAGEN) === */}
  <div style={{ width: "320px", display: "flex", flexDirection: "column", gap: "14px" }}>
    
    {/* VIDEO AUTO-PLAY */}
    {currentTool.video && (
  <video
    key={currentTool.video}
    src={currentTool.video}
    autoPlay
    muted={false}
    controls={false}        // ❌ No mostrar controles
    disablePictureInPicture // ❌ No permitir PiP
    controlsList="nodownload nofullscreen noplaybackrate" // ❌ Quita más menús
    style={{
      width: "100%",
      borderRadius: 12,
      border: "1px solid var(--card-border)",
      pointerEvents: "none" // ❌ Evita clicks (no pausa, no nada)
      
    }}
    
  />
)}

    {/* IMAGEN (SI EXISTE) */}
    {currentTool.image && (
      <div className="modal-image" style={{ borderRadius: 12, overflow: "hidden" }}>
        <img src={currentTool.image} style={{ width: "100%" }} />
        <div className="muted small" style={{ padding: 8 }}>
          Imagen de referencia de laboratorio.
        </div>
      </div>
    )}
  </div>
</div>


 <div className="modal-footer">
 <button className="btn" onClick={closeTool}>
 Cerrar
 </button>
 </div>
 </div>
 </div>
 )}

 <style>{`
 :root{
 /* Tema */
 --bg-1:#0b1220; --bg-2:#0a1730; --card:rgba(255,255,255,.06);
 --card-border:rgba(255,255,255,.12); --txt:#e6f0ff; --muted:#9bb3d1;
 --primary:#52e5ff; --accent:#8a7dff; --success:#3cf0a5; --danger:#ff5c7c;
 /* Foto y separación */
 --photo-size:240px;
 --photo-gap:14px;
 }
 *{box-sizing:border-box}
 html,body{background:transparent}

 /* ===== Fondo full-bleed + decoraciones ===== */
 .wrap-page{
 position:relative; min-height:100dvh; padding:24px; color:var(--txt);
 width:100vw; margin-left:calc(50% - 50vw); margin-right:calc(50% - 50vw);
 background:
 radial-gradient(1000px 600px at 20% -20%, #15305e40 0%, transparent 60%),
 linear-gradient(180deg,var(--bg-1),var(--bg-2));
 }
 .wrap{max-width:1280px; margin:0 auto}
 .bgOrbit{position:absolute; inset:-10%; background:
 radial-gradient(800px 800px at 110% 10%, #52e5ff1f 0%, transparent 60%),
 radial-gradient(600px 600px at -10% 110%, #8a7dff1a 0%, transparent 60%);
 filter:blur(20px); pointer-events:none}
 .bgGrid{position:absolute; inset:0; background-image:
 linear-gradient(transparent 95%, #ffffff08 95%),
 linear-gradient(90deg, transparent 95%, #ffffff08 95%);
 background-size:40px 40px;
 mask-image:radial-gradient(60% 60% at 50% 40%, black 60%, transparent 100%);
 pointer-events:none}

 /* ===== Topbar / Toolbar ===== */
 .topbar{
 display:flex; gap:12px; align-items:center; justify-content:space-between;
 padding:10px 14px; border:1px solid var(--card-border); border-radius:12px;
 background:rgba(255,255,255,.04); margin-bottom:10px;
 }
 .topbar .title{font-weight:600}
 .topbar .search{
 width:100%; padding:8px 10px; border-radius:10px;
 border:1px solid var(--card-border); background:rgba(255,255,255,.06); color:var(--txt);
 }
 .search-dropdown{
 position:absolute; right:0; top:calc(100% + 8px); width:100%; max-height:300px;
 background:rgba(11,18,32,.96); border:1px solid var(--card-border); border-radius:12px;
 box-shadow:0 12px 30px rgba(0,0,0,.45); backdrop-filter:blur(12px); overflow-y:auto;
 padding:8px 0; z-index:60;
 }
 .search-result{
 width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:4px;
 padding:10px 14px; background:transparent; border:none; color:var(--txt);
 text-align:left; cursor:pointer; transition:background .2s ease;
 }
 .search-result:hover,
 .search-result:focus{
 background:rgba(255,255,255,.08); outline:none;
 }
 .search-result__name{font-weight:600; font-size:14px}
 .search-result__meta{font-size:12px; color:var(--muted)}
 .search-empty,
 .search-loading{padding:12px 14px; font-size:13px; color:var(--muted)}
 .toolbar{display:flex; gap:8px; margin:8px 0 14px}

 /* ===== Tarjetas / tablas ===== */
 .card{background:rgba(255,255,255,.03); border:1px solid var(--card-border); border-radius:14px}
 .pad{padding:14px}
 .divider{height:1px; background:linear-gradient(90deg,transparent,#ffffff1a,transparent); margin:16px 0}
 .subcard{background:rgba(255,255,255,.03); border:1px solid var(--card-border); border-radius:14px; padding:12px}
 .subcard h3{margin:0 0 10px}
 .table{
 width:100%; border-collapse:separate; border-spacing:0; font-size:14px;
 border:1px solid var(--card-border); border-radius:12px; overflow:hidden;
 }
 .table th,.table td{padding:10px 12px; border-bottom:1px solid var(--card-border)}
 .table thead th{background:rgba(255,255,255,.04); color:var(--muted); text-align:left}
 .table tbody tr:last-child td{border-bottom:none}

 /* ===== Inputs / botones ===== */
 label{font-size:12px; color:var(--muted)}
 textarea, input, select{
 width:100%; padding:12px 14px; border-radius:12px;
 border:1px solid var(--card-border); background:rgba(255,255,255,.04);
 color:var(--txt); outline:none; transition:.2s;
 }
 textarea{min-height:110px; resize:vertical}
 textarea:focus, input:focus, select:focus{border-color:#68ecff88; box-shadow:0 0 0 3px #52e5ff22}
 .btn{
 --padX:14px; --padY:10px; padding:var(--padY) var(--padX);
 border-radius:12px; border:1px solid var(--card-border);
 background:rgba(255,255,255,.05); color:var(--txt); cursor:pointer; transition:.2s;
 }
 .btn:hover{transform:translateY(-1px); box-shadow:0 8px 18px #0006}
 .toolbar .btn{background:linear-gradient(135deg,var(--primary),var(--accent)); color:#04121f; border-color:transparent}

 /* ===== Botones ghost para herramientas IA ===== */
 .tool-grid{
 display:grid;
 grid-template-columns:repeat(2,minmax(0,1fr));
 gap:8px;
 margin-top:6px;
 }
 .btn-ghost{
 padding:9px 10px;
 border-radius:10px;
 border:1px solid var(--card-border);
 background:rgba(15,23,42,.65);
 color:var(--muted);
 font-size:12px;
 text-align:left;
 cursor:pointer;
 transition:.18s;
 }
 .btn-ghost:hover{
 border-color:var(--primary);
 color:var(--txt);
 background:rgba(15,23,42,.95);
 transform:translateY(-1px);
 box-shadow:0 10px 24px #0008;
 }

 /* ===== Grids de formulario ===== */
 .row-3{display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px}
 .row-4{display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px}

 /* ===== Layout superior (izq: form/chat | der: foto + notas) ===== */
 .patient-row{
 display:grid;
 grid-template-columns:minmax(520px,1fr) minmax(420px,1fr);
 gap:16px; align-items:start;
 }
 /* Foto arriba a la derecha */
 .photoCell{
 grid-column:2; grid-row:1;
 justify-self:center; align-self:start;
 position:relative; margin-bottom:0;
 }
 .photo{
 width:var(--photo-size); height:var(--photo-size);
 border-radius:16px; overflow:hidden;
 border:1px solid var(--card-border); background:rgba(255,255,255,.04);
 box-shadow:0 8px 30px #0006;
 }
 .photo img{width:100%; height:100%; object-fit:cover; display:block}
 /* Notas del médico: misma fila que la foto, justo debajo */
 .span-under-photo{
 grid-column:2; grid-row:1; align-self:start;
 margin-top:calc(var(--photo-size) + var(--photo-gap));
 }

 /* ===== Pre-diagnóstico IA ===== */
 .preDxFull{
 margin-top:10px; padding:10px 12px; border-radius:12px;
 border:1px dashed var(--card-border); background:rgba(255,255,255,.04);
 }
 .preDxFull .muted{margin-top:6px}

 /* ===== Tabs ===== */
 .tabs{margin-top:14px}
 .tablist{
 display:flex; gap:8px; padding:6px; border:1px solid var(--card-border);
 border-radius:12px; background:rgba(255,255,255,.04); margin-bottom:10px; flex-wrap:wrap;
 }
 .tab{
 padding:8px 12px; border-radius:10px; border:1px solid transparent; cursor:pointer;
 background:transparent; color:var(--muted); transition:.2s;
 }
 .tab[aria-selected="true"]{color:#061824; background:linear-gradient(135deg,var(--primary),var(--accent))}
 .tabpanel{display:none}
 .tabpanel.active{display:block}

 /* ===== Sección inferior (General): izquierda grande + derecha notas rápidas ===== */
 .grid-2{display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:16px}
 #txtNotes{min-height:100px}
 .facts{display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; margin-top:10px}
 .fact{background:rgba(255,255,255,.03); border:1px solid var(--card-border); border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:6px}
 .fact b{color:var(--muted); font-weight:600}

 /* ===== MODAL IA ===== */
 .modal-backdrop{
 position:fixed;
 inset:0;
 background:rgba(15,23,42,.78);
 backdrop-filter:blur(10px);
 display:flex;
 align-items:center;
 justify-content:center;
 z-index:40;
 }
 .modal{
 width:min(820px,96vw);
 max-height:90vh;
 background:radial-gradient(circle at top left,#1f2937,#020617);
 border-radius:18px;
 border:1px solid var(--card-border);
 box-shadow:0 24px 60px #000a;
 display:flex;
 flex-direction:column;
 }
 .modal-header{
 display:flex;
 align-items:center;
 justify-content:space-between;
 padding:14px 18px;
 border-bottom:1px solid var(--card-border);
 }
 .modal-body{
 padding:14px 18px;
 overflow:auto;
 }
 .modal-footer{
 padding:12px 18px;
 border-top:1px solid var(--card-border);
 display:flex;
 gap:8px;
 justify-content:flex-end;
 }
 .modal-close{
 border:none;
 background:transparent;
 color:var(--muted);
 cursor:pointer;
 font-size:18px;
 }
 .typing-block{
 background:rgba(15,23,42,.9);
 border-radius:12px;
 border:1px solid var(--card-border);
 padding:12px 14px;
 font-family:system-ui, -apple-system, BlinkMacSystemFont, "SF Mono", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
 font-size:13px;
 white-space:pre-wrap;
 }
 .caret{
 display:inline-block;
 margin-left:1px;
 animation:blink 1s steps(1,end) infinite;
 }
 @keyframes blink{
 0%,50%{opacity:1}
 50.01%,100%{opacity:0}
 }
 .modal-image{
 margin-top:12px;
 border-radius:12px;
 overflow:hidden;
 border:1px solid var(--card-border);
 background:#020617;
 }
 .modal-image img{
 width:100%;
 display:block;
 }
 .small{font-size:11px;}

 /* ===== Responsive ===== */
 @media (max-width:1100px){
 .patient-row{grid-template-columns:1fr}
 .photoCell{grid-column:auto; grid-row:auto; justify-self:center; margin-bottom:10px}
 .span-under-photo{grid-column:auto; grid-row:auto; margin-top:0}
 .photo{width:220px; height:220px}
 .grid-2{grid-template-columns:1fr}
 }
 `}</style>
 </div>
 );
}