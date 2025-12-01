import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import TopNav from "./components/TopNav";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/AdminDashboard";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import PatientDashboard from "./pages/patient/PatientDashboard";
import "./index.css";

type UserRole = "doctor" | "paciente" | "admin";

type ProtectedRouteProps = {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
};

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const storedUser = localStorage.getItem("user");

  if (!storedUser) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(storedUser) as { rol?: UserRole; paciente_id?: number; medico_id?: number };
    const role = user?.rol;

    if (!role) {
      localStorage.removeItem("user");
      return <Navigate to="/login" replace />;
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      const fallback = role === "paciente" ? "/patient" : role === "doctor" ? "/doctor" : "/login";
      return <Navigate to={fallback} replace />;
    }

    if (role === "paciente" && user?.paciente_id && !localStorage.getItem("patient_id")) {
      localStorage.setItem("patient_id", String(user.paciente_id));
    }

    if (role === "doctor" && user?.medico_id && !localStorage.getItem("medico_id")) {
      localStorage.setItem("medico_id", String(user.medico_id));
    }

    return children;
  } catch (error) {
    console.error("ProtectedRoute error:", error);
    localStorage.removeItem("user");
    localStorage.removeItem("patient_id");
    localStorage.removeItem("medico_id");
    return <Navigate to="/login" replace />;
  }
}

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <TopNav />
        <main className="container">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route 
              path="/patient" 
              element={
                <ProtectedRoute allowedRoles={["paciente"]}>
                  <PatientDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/doctor" 
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorDashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <footer className="footer">Asistente Médico IA — <a href="/">Inicio</a></footer>
        <Toaster position="top-right" />
      </Router>
    </QueryClientProvider>
  );
}
