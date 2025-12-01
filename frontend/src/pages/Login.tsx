import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

// Obtener URL del API desde variables de entorno o usar localhost por defecto
const getAPIUrl = () => {
  const envAuth = import.meta.env.VITE_AUTH_API;
  if (envAuth) {
    return envAuth;
  }
  const envApi = import.meta.env.VITE_API;
  if (envApi) {
    return envApi;
  }
  // Si no hay variable de entorno, usar localhost
  return "http://localhost:8080";
};

const API = getAPIUrl();

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("Intentando login con:", { username, API });
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ username, password }),
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data = await response.json();
      console.log("Login response:", data);

      if (data.success && data.user) {
        // Guardar información del usuario en localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        
        // Redirigir según el rol
        if (data.user.rol === "doctor") {
          localStorage.setItem("medico_id", data.user.medico_id.toString());
          toast.success(`¡Bienvenido, ${data.user.medico_nombre || username}!`);
          navigate("/doctor");
        } else if (data.user.rol === "paciente") {
          localStorage.setItem("patient_id", data.user.paciente_id.toString());
          toast.success(`¡Bienvenido, ${data.user.paciente_nombre || username}!`);
          navigate("/patient");
        } else {
          toast.error("Rol no reconocido");
        }
      } else {
        toast.error(data.error || "Credenciales inválidas");
      }
    } catch (error: any) {
      console.error("Error en login:", error);
      const errorMessage = error.message || "Error al conectar con el servidor";
      toast.error(errorMessage);
      console.error("Detalles del error:", {
        message: error.message,
        stack: error.stack,
        API_URL: API
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🩺 AI-MedAssistant</h1>
        <p style={styles.subtitle}>Inicia sesión para acceder a tu perfil</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Usuario o Correo</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="carlos_ramirez o carlos.ramirez@test.com"
              style={styles.input}
              required
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
              style={styles.input}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            style={styles.button}
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>

          <div style={styles.registerLink}>
            <span style={styles.registerText}>¿No tienes cuenta?</span>
            <Link to="/register" style={styles.link}>
              Regístrate aquí
            </Link>
          </div>
        </form>

        
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #0b1220, #0a1730)",
    padding: "20px",
  },
  card: {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "450px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  },
  title: {
    color: "#fff",
    fontSize: "32px",
    fontWeight: 700,
    margin: "0 0 8px 0",
    textAlign: "center",
  },
  subtitle: {
    color: "#aaa",
    fontSize: "16px",
    margin: "0 0 32px 0",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
  },
  input: {
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#fff",
    fontSize: "16px",
    outline: "none",
    transition: "all 0.3s",
  },
  button: {
    padding: "14px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(45deg, #2ecc71, #27ae60)",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s",
    marginTop: "8px",
  },
  testAccounts: {
    marginTop: "32px",
    padding: "20px",
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  testTitle: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    margin: "0 0 16px 0",
  },
  accountList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  accountItem: {
    color: "#fff",
    fontSize: "14px",
  },
  accountDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginTop: "8px",
    fontSize: "12px",
    color: "#aaa",
  },
  note: {
    marginTop: "16px",
    fontSize: "12px",
    color: "#888",
    textAlign: "center",
    fontStyle: "italic",
  },
  registerLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "16px",
  },
  registerText: {
    color: "#aaa",
    fontSize: "14px",
  },
  link: {
    color: "#2ecc71",
    textDecoration: "none",
    fontWeight: 600,
    transition: "all 0.3s",
  },
};

