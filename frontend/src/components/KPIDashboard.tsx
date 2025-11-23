import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// === Tipos ===
type Patient = {
  id?: string;
  name: string;
  age?: string | number;
  appointments?: Array<{
    id: string;
    date: string;
    time?: string;
    diagnosisSummary?: string;
    prescription?: string;
    recommendations?: string;
  }>;
  aiConversations?: Array<{
    id: string;
    date: string;
    summary: string;
  }>;
};

type KPIDashboardProps = {
  type: 'patient' | 'doctor';
  patient?: Patient;
  patients?: Patient[];
  className?: string;
};

// === Datos demo para gráficas ===
const symptomsData = [
  { date: '2025-01-01', consultations: 2, symptoms: 3 },
  { date: '2025-01-08', consultations: 1, symptoms: 1 },
  { date: '2025-01-15', consultations: 3, symptoms: 4 },
  { date: '2025-01-22', consultations: 2, symptoms: 2 },
  { date: '2025-01-29', consultations: 1, symptoms: 1 },
];

const diagnosisData = [
  { name: 'Cefalea tensional', value: 35, color: '#52e5ff' },
  { name: 'Rinitis alérgica', value: 25, color: '#8a7dff' },
  { name: 'Fatiga general', value: 20, color: '#3cf0a5' },
  { name: 'Dolor muscular', value: 15, color: '#ff5c7c' },
  { name: 'Otros', value: 5, color: '#ffa726' },
];

const weeklyConsultations = [
  { week: 'Sem 1', consultations: 12 },
  { week: 'Sem 2', consultations: 15 },
  { week: 'Sem 3', consultations: 18 },
  { week: 'Sem 4', consultations: 14 },
];

const doctorDiagnosisData = [
  { name: 'Hipertensión', value: 30, color: '#52e5ff' },
  { name: 'Diabetes', value: 25, color: '#8a7dff' },
  { name: 'Obesidad', value: 20, color: '#3cf0a5' },
  { name: 'Ansiedad', value: 15, color: '#ff5c7c' },
  { name: 'Otros', value: 10, color: '#ffa726' },
];

// === Componente KPI Card ===
function KPICard({ icon, title, value, subtitle, trend }: {
  icon: string;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__header">
        <div className="kpi-card__icon">{icon}</div>
        <div className="kpi-card__title">{title}</div>
      </div>
      <div className="kpi-card__value">{value}</div>
      {subtitle && <div className="kpi-card__subtitle">{subtitle}</div>}
      {trend && (
        <div className={`kpi-card__trend kpi-card__trend--${trend}`}>
          {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '→'}
        </div>
      )}
    </div>
  );
}

// === Componente principal ===
export default function KPIDashboard({ type, patient, patients = [], className = '' }: KPIDashboardProps) {
  // === Cálculos para paciente ===
  const patientKPIs = React.useMemo(() => {
    if (!patient || type !== 'patient') return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Próximas citas este mes
    const upcomingAppointments = (patient.appointments || []).filter(apt => {
      const aptDate = new Date(apt.date);
      return aptDate >= now && aptDate.getMonth() === currentMonth && aptDate.getFullYear() === currentYear;
    }).length;

    // Días sin síntomas (última consulta con síntomas)
    const lastSymptomDate = patient.aiConversations?.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
    const daysWithoutSymptoms = lastSymptomDate 
      ? Math.floor((now.getTime() - new Date(lastSymptomDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Porcentaje de cumplimiento (simulado)
    const complianceRate = Math.floor(Math.random() * 40) + 60; // 60-100%

    return {
      upcomingAppointments,
      daysWithoutSymptoms,
      complianceRate
    };
  }, [patient, type]);

  // === Cálculos para doctor ===
  const doctorKPIs = React.useMemo(() => {
    if (type !== 'doctor') return null;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Total pacientes activos
    const activePatients = patients.length;

    // Citas esta semana (simulado)
    const weeklyAppointments = Math.floor(Math.random() * 20) + 10;

    // Tiempo promedio entre consultas (simulado)
    const avgTimeBetweenConsultations = Math.floor(Math.random() * 15) + 7; // 7-21 días

    return {
      activePatients,
      weeklyAppointments,
      avgTimeBetweenConsultations
    };
  }, [patients, type]);

  if (type === 'patient') {
    return (
      <div className={`kpi-dashboard kpi-dashboard--patient ${className}`}>
        <h3 className="kpi-dashboard__title">📊 Métricas de Salud</h3>
        
        {/* KPI Cards */}
        <div className="kpi-grid">
          <KPICard
            icon="📅"
            title="Próximas Citas"
            value={patientKPIs?.upcomingAppointments || 0}
            subtitle="Este mes"
            trend="neutral"
          />
          <KPICard
            icon="😊"
            title="Días Sin Síntomas"
            value={patientKPIs?.daysWithoutSymptoms || 0}
            subtitle="Desde última consulta"
            trend="up"
          />
          <KPICard
            icon="✅"
            title="Cumplimiento"
            value={`${patientKPIs?.complianceRate || 0}%`}
            subtitle="Recomendaciones"
            trend="up"
          />
        </div>

        {/* Gráficas */}
        <div className="charts-grid">
          {/* Evolución de síntomas */}
          <div className="chart-container">
            <h4 className="chart-title">📈 Evolución de Consultas (30 días)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={symptomsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12, fill: '#9bb3d1' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12, fill: '#9bb3d1' }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(11,18,32,0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: '#e6f0ff'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="consultations" 
                  stroke="#52e5ff" 
                  strokeWidth={2}
                  dot={{ fill: '#52e5ff', strokeWidth: 2, r: 4 }}
                  name="Consultas"
                />
                <Line 
                  type="monotone" 
                  dataKey="symptoms" 
                  stroke="#8a7dff" 
                  strokeWidth={2}
                  dot={{ fill: '#8a7dff', strokeWidth: 2, r: 4 }}
                  name="Síntomas"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Diagnósticos más frecuentes */}
          <div className="chart-container">
            <h4 className="chart-title">🥧 Diagnósticos Frecuentes</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={diagnosisData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {diagnosisData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(11,18,32,0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: '#e6f0ff'
                  }}
                  formatter={(value: any) => [`${value}%`, 'Frecuencia']}
                />
                <Legend 
                  wrapperStyle={{ color: '#9bb3d1', fontSize: '12px' }}
                  formatter={(value) => <span style={{ color: '#e6f0ff' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Estilos */}
        <style>{`
          .kpi-dashboard--patient {
            margin-top: 20px;
          }
          
          .kpi-dashboard__title {
            font-size: 18px;
            font-weight: 600;
            color: #e6f0ff;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }
          
          .kpi-card {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(12px);
            position: relative;
            transition: all 0.3s ease;
          }
          
          .kpi-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(82,229,255,0.15);
            border-color: rgba(82,229,255,0.3);
          }
          
          .kpi-card__header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }
          
          .kpi-card__icon {
            font-size: 24px;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #52e5ff, #8a7dff);
            border-radius: 12px;
            color: #04121f;
          }
          
          .kpi-card__title {
            font-size: 14px;
            color: #9bb3d1;
            font-weight: 500;
          }
          
          .kpi-card__value {
            font-size: 32px;
            font-weight: 700;
            color: #e6f0ff;
            margin-bottom: 4px;
            background: linear-gradient(135deg, #52e5ff, #8a7dff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .kpi-card__subtitle {
            font-size: 12px;
            color: #9bb3d1;
          }
          
          .kpi-card__trend {
            position: absolute;
            top: 16px;
            right: 16px;
            font-size: 18px;
          }
          
          .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          
          .chart-container {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(12px);
          }
          
          .chart-title {
            font-size: 16px;
            font-weight: 600;
            color: #e6f0ff;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          @media (max-width: 768px) {
            .kpi-grid {
              grid-template-columns: 1fr;
            }
            
            .charts-grid {
              grid-template-columns: 1fr;
            }
            
            .kpi-card {
              padding: 16px;
            }
            
            .kpi-card__value {
              font-size: 28px;
            }
          }
        `}</style>
      </div>
    );
  }

  if (type === 'doctor') {
    return (
      <div className={`kpi-dashboard kpi-dashboard--doctor ${className}`}>
        <h3 className="kpi-dashboard__title">📊 Métricas Clínicas</h3>
        
        {/* KPI Cards */}
        <div className="kpi-grid">
          <KPICard
            icon="👥"
            title="Pacientes Activos"
            value={doctorKPIs?.activePatients || 0}
            subtitle="En seguimiento"
            trend="up"
          />
          <KPICard
            icon="📅"
            title="Citas Esta Semana"
            value={doctorKPIs?.weeklyAppointments || 0}
            subtitle="Últimos 7 días"
            trend="neutral"
          />
          <KPICard
            icon="⏱️"
            title="Tiempo Promedio"
            value={`${doctorKPIs?.avgTimeBetweenConsultations || 0} días`}
            subtitle="Entre consultas"
            trend="neutral"
          />
        </div>

        {/* Gráficas */}
        <div className="charts-grid">
          {/* Consultas por semana */}
          <div className="chart-container">
            <h4 className="chart-title">📊 Consultas por Semana</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyConsultations}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12, fill: '#9bb3d1' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#9bb3d1' }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(11,18,32,0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: '#e6f0ff'
                  }}
                />
                <Bar 
                  dataKey="consultations" 
                  fill="url(#doctorGradient)"
                  radius={[4, 4, 0, 0]}
                />
                <defs>
                  <linearGradient id="doctorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52e5ff" />
                    <stop offset="95%" stopColor="#8a7dff" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Diagnósticos más frecuentes */}
          <div className="chart-container">
            <h4 className="chart-title">🥧 Diagnósticos Comunes</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={doctorDiagnosisData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {doctorDiagnosisData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(11,18,32,0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: '#e6f0ff'
                  }}
                  formatter={(value: any) => [`${value}%`, 'Frecuencia']}
                />
                <Legend 
                  wrapperStyle={{ color: '#9bb3d1', fontSize: '12px' }}
                  formatter={(value) => <span style={{ color: '#e6f0ff' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Estilos (reutiliza los del paciente con algunas variaciones) */}
        <style>{`
          .kpi-dashboard--doctor {
            margin-top: 20px;
          }
          
          .kpi-dashboard__title {
            font-size: 18px;
            font-weight: 600;
            color: #e6f0ff;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }
          
          .kpi-card {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(12px);
            position: relative;
            transition: all 0.3s ease;
          }
          
          .kpi-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(138,125,255,0.15);
            border-color: rgba(138,125,255,0.3);
          }
          
          .kpi-card__header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }
          
          .kpi-card__icon {
            font-size: 24px;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #8a7dff, #52e5ff);
            border-radius: 12px;
            color: #04121f;
          }
          
          .kpi-card__title {
            font-size: 14px;
            color: #9bb3d1;
            font-weight: 500;
          }
          
          .kpi-card__value {
            font-size: 32px;
            font-weight: 700;
            color: #e6f0ff;
            margin-bottom: 4px;
            background: linear-gradient(135deg, #8a7dff, #52e5ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .kpi-card__subtitle {
            font-size: 12px;
            color: #9bb3d1;
          }
          
          .kpi-card__trend {
            position: absolute;
            top: 16px;
            right: 16px;
            font-size: 18px;
          }
          
          .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          
          .chart-container {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(12px);
          }
          
          .chart-title {
            font-size: 16px;
            font-weight: 600;
            color: #e6f0ff;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          @media (max-width: 768px) {
            .kpi-grid {
              grid-template-columns: 1fr;
            }
            
            .charts-grid {
              grid-template-columns: 1fr;
            }
            
            .kpi-card {
              padding: 16px;
            }
            
            .kpi-card__value {
              font-size: 28px;
            }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
