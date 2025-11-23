const DEFAULT_API = import.meta.env.VITE_API || "http://localhost:8080"; // Compatibilidad monolito
const DOCTOR_API = import.meta.env.VITE_DOCTOR_API || DEFAULT_API;
const PATIENT_API = import.meta.env.VITE_PATIENT_API || DEFAULT_API;
const AI_API = import.meta.env.VITE_AI_API || DEFAULT_API;
const ADMIN_API = import.meta.env.VITE_ADMIN_API || DEFAULT_API;

function withBase(base: string, path: string): string {
  if (path.startsWith("http")) return path;
  const trimmedBase = base.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

async function tryFetch(url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, init);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } catch (e) { return null; }
}

async function tryFetchXML(url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, init);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const xmlText = await r.text();
    return parseXMLResponse(xmlText);
  } catch (e) { return null; }
}

function createXMLRequest(data: any): string {
  let xml = '<request>';
  
  if (data.patient) {
    xml += '<patient>';
    for (const [key, value] of Object.entries(data.patient)) {
      xml += `<${key}>${value}</${key}>`;
    }
    xml += '</patient>';
  }
  
  if (data.symptoms) {
    xml += `<symptoms>${data.symptoms}</symptoms>`;
  }
  
  if (data.studies && Array.isArray(data.studies)) {
    xml += '<studies>';
    data.studies.forEach((study: string) => {
      xml += `<study>${study}</study>`;
    });
    xml += '</studies>';
  }
  
  xml += '</request>';
  return xml;
}

function parseXMLResponse(xmlText: string): any {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const response: any = {};
    
    const children = xmlDoc.documentElement.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      response[child.tagName] = child.textContent || '';
    }
    
    return response;
  } catch (e) {
    console.error('Error parsing XML:', e);
    return null;
  }
}

/* ---------- ADMIN ---------- */
const admin = {
  async listUsers() {
    const data = await tryFetch(withBase(ADMIN_API, "/api/admin/users"));
    return data ?? []; // Sin datos mock - retornar vacío si no hay datos
  },
  async updateUser(id: string, changes: any) {
    const data = await tryFetch(withBase(ADMIN_API, `/api/admin/users/${id}`), {
      method: "PUT",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(changes)
    });
    return data ?? true;
  }
};

/* ---------- DOCTOR (localStorage + IA real) ---------- */
const LS_PATIENTS = "doctor_patients";

function listPatientsLS(): any[] {
  const raw = localStorage.getItem(LS_PATIENTS);
  return raw ? JSON.parse(raw) : [];
}
function savePatientLS(p: any) {
  const list = listPatientsLS();
  let saved = p;
  if (!p.id) {
    saved = { ...p, id: `p_${Date.now()}` };
    localStorage.setItem(LS_PATIENTS, JSON.stringify([saved, ...list]));
    return { saved, list: [saved, ...list] };
  } else {
    const next = list.map((x:any)=> x.id===p.id ? p : x);
    localStorage.setItem(LS_PATIENTS, JSON.stringify(next));
    return { saved: p, list: next };
  }
}
const doctor = {
  listPatients: listPatientsLS,
  savePatient: savePatientLS,
  async searchPatients(doctorId: number, query: string, options?: { signal?: AbortSignal; limit?: number }) {
    const trimmed = (query || "").trim();
    if (!doctorId || trimmed.length < 2) {
      return [];
    }

    const params = new URLSearchParams({ query: trimmed });
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }

    const response = await fetch(
      withBase(DOCTOR_API, `/api/db/doctor/${doctorId}/patients/search?${params.toString()}`),
      { signal: options?.signal }
    );

    if (!response.ok) {
      let message = `Error ${response.status}`;
      try {
        const text = await response.text();
        if (text) message = text;
      } catch (error) {
        // ignore body read errors
      }
      throw new Error(message);
    }

    return await response.json();
  },
  async askAI(payload: any) {
    const xmlBody = createXMLRequest(payload);
    const data = await tryFetchXML(withBase(AI_API, "/api/ai/doctor"), {
      method: "POST",
      headers: { "Content-Type":"application/xml" },
      body: xmlBody
    });
    return data ?? { recommendation: "Backend no respondió. Revisa Flask/ENV." };
  }
};

/* ---------- PATIENT (localStorage + IA) ---------- */
const LS_OWNER = "patient_owner";
const LS_DEPS  = "patient_dependents";

function listProfilesLS() {
  let owner = localStorage.getItem(LS_OWNER);
  if (!owner) {
    owner = JSON.stringify({ id:"owner", name:"Yo", relation:"owner" });
    localStorage.setItem(LS_OWNER, owner);
  }
  const list = JSON.parse(localStorage.getItem(LS_DEPS) || "[]");
  return { owner: JSON.parse(owner), list };
}
function saveProfileLS(p: any) {
  if (p.relation === "owner" || p.id === "owner") {
    const saved = { ...p, id:"owner", relation:"owner" };
    localStorage.setItem(LS_OWNER, JSON.stringify(saved));
    const list = JSON.parse(localStorage.getItem(LS_DEPS) || "[]");
    return { saved, list };
  } else {
    const list = JSON.parse(localStorage.getItem(LS_DEPS) || "[]");
    let saved = p;
    if (!p.id) {
      saved = { ...p, id:`d_${Date.now()}` };
      const next = [saved, ...list];
      localStorage.setItem(LS_DEPS, JSON.stringify(next));
      return { saved, list: next };
    } else {
      const next = list.map((x:any)=> x.id===p.id ? p : x);
      localStorage.setItem(LS_DEPS, JSON.stringify(next));
      return { saved: p, list: next };
    }
  }
}

const patient = {
  listProfiles: listProfilesLS,
  saveProfile: saveProfileLS,
  async askAI(payload: any) {
    // Web client uses XML
    const xmlBody = createXMLRequest(payload);
    const data = await tryFetchXML(withBase(AI_API, "/api/ai/patient"), {
      method: "POST",
      headers: { "Content-Type":"application/xml" },
      body: xmlBody
    });
    return data ?? { message: "Backend no respondió. Revisa Flask/ENV." };
  },
  // Nuevos métodos para base de datos
  async getPatient(id: number) {
    return await tryFetch(withBase(PATIENT_API, `/api/db/patient/${id}`));
  },
  async getConsultations(patientId: number) {
    return await tryFetch(withBase(PATIENT_API, `/api/db/patient/${patientId}/consultations`));
  },
  async getFiles(patientId: number) {
    return await tryFetch(withBase(PATIENT_API, `/api/db/patient/${patientId}/files`));
  },
  async updatePatient(id: number, payload: any) {
    return await tryFetch(withBase(PATIENT_API, `/api/db/patient/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  async getInteractions(patientId: number, limit: number = 50) {
    return await tryFetch(withBase(PATIENT_API, `/api/db/patient/${patientId}/interactions?limit=${limit}`));
  }
};

// Nuevo módulo para base de datos
const database = {
  async getDoctors() {
    return await tryFetch(withBase(DOCTOR_API, "/api/db/doctors")) ?? [];
  },
  async getCatalogos() {
    return await tryFetch(withBase(PATIENT_API, "/api/db/catalogos")) ?? {};
  },
  async getInteractions(limit: number = 50, tipo?: string) {
    const url = tipo 
      ? withBase(PATIENT_API, `/api/db/interactions?limit=${limit}&tipo=${tipo}`)
      : withBase(PATIENT_API, `/api/db/interactions?limit=${limit}`);
    return await tryFetch(url) ?? { total: 0, interactions: [] };
  }
};

// Agregar método a admin para obtener interacciones
const adminWithInteractions = {
  ...admin,
  async getInteractions(limit: number = 50) {
    return await database.getInteractions(limit);
  }
};

export const api = { admin: adminWithInteractions, doctor, patient, database };
