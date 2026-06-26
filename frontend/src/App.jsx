import React, { useState, useEffect } from 'react';
import Login from './components/Login.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import Agenda from './components/Agenda.jsx';
import Pacientes from './components/Pacientes.jsx';
import ListaEspera from './components/ListaEspera.jsx';
import Usuarios from './components/Usuarios.jsx';
import Historico from './components/Historico.jsx';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('agenda_farol_token'));
  const [usuario, setUsuario] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' or 'error'

  // Pre-selected patient when converting from waitlist to booking
  const [selectedPatientForBooking, setSelectedPatientForBooking] = useState(null);

  // Toast handler
  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
  };

  // Auto-hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load session from token on startup
  useEffect(() => {
    const checkSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        
        if (res.ok) {
          setUsuario(data.usuario);
          // Set default tab based on user type
          if (data.usuario.tipo === 'voluntario') {
            setActiveTab('agenda');
          } else {
            setActiveTab('dashboard');
          }
        } else {
          // Token expired or invalid
          handleLogout();
        }
      } catch (err) {
        console.error('Error validating session:', err);
        handleLogout();
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [token]);

  const handleLoginSuccess = (newToken, newUser) => {
    localStorage.setItem('agenda_farol_token', newToken);
    setToken(newToken);
    setUsuario(newUser);
    if (newUser.tipo === 'voluntario') {
      setActiveTab('agenda');
    } else {
      setActiveTab('dashboard');
    }
    showToast(`Bem-vindo, ${newUser.nome}! Login realizado com sucesso.`);
  };

  const handleLogout = () => {
    localStorage.removeItem('agenda_farol_token');
    setToken(null);
    setUsuario(null);
    setActiveTab('dashboard');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Convert waitlist patient to appointment
  const handleConvertToAppointment = (patientId, patientName) => {
    setSelectedPatientForBooking({ id: patientId, name: patientName });
    setActiveTab('agenda');
    showToast(`Paciente ${patientName} pré-selecionado! Escolha um horário livre na agenda para reservar.`);
  };

  const handleClearPreselectedPatient = () => {
    setSelectedPatientForBooking(null);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Resumo e Lembretes Diários';
      case 'agenda': return 'Agenda de Atendimentos';
      case 'pacientes': return 'Cadastro de Pacientes';
      case 'lista-espera': return 'Fila de Espera';
      case 'usuarios': return 'Gestão de Usuários e Horários';
      case 'historico': return 'Histórico de Atendimentos';
      default: return 'Agenda Farol';
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'var(--font-title)',
        fontSize: '1.2rem',
        color: 'var(--text-muted)'
      }}>
        Iniciando Agenda Farol...
      </div>
    );
  }

  // If not authenticated, render Login
  if (!token || !usuario) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} />
        {toastMessage && (
          <div className={`toast ${toastType}`}>
            {toastType === 'success' ? '✓' : '⚠️'} {toastMessage}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        usuario={usuario}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
      />

      {/* Main Panel Viewport */}
      <main className="main-content">
        <header className="header">
          <div className="header-title">
            <h2>{getTabTitle()}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.9rem' }}>
            <span>📅 {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              padding: '6px 12px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.8rem'
            }}>
              {usuario.tipo === 'admin' ? 'Secretária' : 'Profissional Voluntário'}
            </span>
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'dashboard' && usuario.tipo === 'admin' && (
            <Dashboard
              token={token}
              toast={showToast}
              onNavigateToTab={handleTabChange}
            />
          )}

          {activeTab === 'agenda' && (
            <Agenda
              token={token}
              usuario={usuario}
              toast={showToast}
              preselectedPatient={selectedPatientForBooking}
              onClearPreselected={handleClearPreselectedPatient}
            />
          )}

          {activeTab === 'pacientes' && usuario.tipo === 'admin' && (
            <Pacientes
              token={token}
              toast={showToast}
            />
          )}

          {activeTab === 'lista-espera' && usuario.tipo === 'admin' && (
            <ListaEspera
              token={token}
              toast={showToast}
              onConvertToAppointment={handleConvertToAppointment}
            />
          )}

          {activeTab === 'usuarios' && usuario.tipo === 'admin' && (
            <Usuarios
              token={token}
              toast={showToast}
            />
          )}

          {activeTab === 'historico' && usuario.tipo === 'admin' && (
            <Historico
              token={token}
              toast={showToast}
            />
          )}
        </div>
      </main>

      {/* Floating alert notification toast */}
      {toastMessage && (
        <div className={`toast ${toastType}`}>
          {toastType === 'success' ? '✓' : '⚠️'} {toastMessage}
        </div>
      )}
    </div>
  );
}
