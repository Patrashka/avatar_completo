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

export default function Register() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    correo: "",
    nombre: "",
    apellido: "",
    telefono: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    if (!formData.correo.includes("@")) {
      toast.error("Correo electrónico inválido");
      setLoading(false);
      return;
    }

    try {
      console.log("Intentando registro con:", { username: formData.username, API });
      const response = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          correo: formData.correo,
          nombre: formData.nombre,
          apellido: formData.apellido,
          telefono: formData.telefono || undefined,
        }),
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data = await response.json();
      console.log("Register response:", data);

      if (data.success && data.user) {
        toast.success("¡Registro exitoso! Redirigiendo al login...");
        // Redirigir al login después de 1 segundo
        setTimeout(() => {
          navigate("/login");
        }, 1000);
      } else {
        toast.error(data.error || "Error al registrar usuario");
      }
    } catch (error: any) {
      console.error("Error en registro:", error);
      const errorMessage = error.message || "Error al conectar con el servidor";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🩺 AI-MedAssistant</h1>
        <p style={styles.subtitle}>Crea tu cuenta para comenzar</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Usuario *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="juan_perez"
              style={styles.input}
              required
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Correo Electrónico *</label>
            <input
              type="email"
              name="correo"
              value={formData.correo}
              onChange={handleChange}
              placeholder="juan.perez@example.com"
              style={styles.input}
              required
              disabled={loading}
            />
            <small style={styles.hint}>El correo es simulado, no se verifica</small>
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.inputGroup, flex: 1, marginRight: "10px" }}>
              <label style={styles.label}>Nombre</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Juan"
                style={styles.input}
                disabled={loading}
              />
            </div>

            <div style={{ ...styles.inputGroup, flex: 1 }}>
              <label style={styles.label}>Apellido</label>
              <input
                type="text"
                name="apellido"
                value={formData.apellido}
                onChange={handleChange}
                placeholder="Pérez"
                style={styles.input}
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Teléfono</label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="+52 81 1234 5678"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contraseña *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
              style={styles.input}
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Confirmar Contraseña *</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repite tu contraseña"
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
            {loading ? "Registrando..." : "Registrarse"}
          </button>

          <div style={styles.loginLink}>
            <span style={styles.loginText}>¿Ya tienes cuenta?</span>
            <Link to="/login" style={styles.link}>
              Inicia sesión
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
    maxWidth: "500px",
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
  row: {
    display: "flex",
    gap: "10px",
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
  hint: {
    color: "#888",
    fontSize: "12px",
    fontStyle: "italic",
    marginTop: "-4px",
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
  loginLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "16px",
  },
  loginText: {
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

