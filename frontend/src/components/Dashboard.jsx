import React, { useState, useEffect } from 'react';

export default function Dashboard({ token, toast, onNavigateToTab }) {
  const [kpis, setKpis] = useState({
    todayCount: 0,
    waitingCount: 0,
    cancelledToday: 0,
    volunteersCount: 0
  });
  const [alerts, setAlerts] = useState({
    cancelamentos: [],
    confirmacoes: []
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Fetch alerts
      const alertsRes = await fetch('/api/avisos', { headers });
      const alertsData = await alertsRes.json();

      // 2. Fetch waitlist count
      const waitlistRes = await fetch('/api/lista-espera', { headers });
      const waitlistData = await waitlistRes.json();

      // 3. Fetch users (volunteers) count
      const usersRes = await fetch('/api/usuarios', { headers });
      const usersData = await usersRes.json();

      // 4. Fetch today's appointments for KPI
      const todayStr = new Date().toISOString().split('T')[0];
      const todayAppRes = await fetch(`/api/atendimentos?data=${todayStr}`, { headers });
      const todayAppData = await todayAppRes.json();

      const todayTotal = todayAppData.length;
      const todayCancelled = todayAppData.filter(a => a.status === 'cancelado').length;
      const activeVols = usersData.filter(u => u.tipo === 'voluntario').length;

      setKpis({
        todayCount: todayTotal - todayCancelled, // non-cancelled today
        waitingCount: waitlistData.length,
        cancelledToday: todayCancelled,
        volunteersCount: activeVols
      });

      setAlerts({
        cancelamentos: alertsData.cancelamentos || [],
        confirmacoes: alertsData.confirmacoes || []
      });

    } catch (error) {
      toast('Erro ao carregar dados do dashboard: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleAvisarPaciente = async (id) => {
    try {
      const res = await fetch(`/api/avisos/${id}/avisado`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Falha ao registrar aviso.');
      toast('Aviso registrado! O paciente foi notificado.');
      fetchDashboardData(); // Refresh lists
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const handleConfirmarPresenca = async (id) => {
    try {
      const res = await fetch(`/api/atendimentos/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'confirmado' })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Falha ao confirmar atendimento.');
      }
      toast('Atendimento confirmado com sucesso!');
      fetchDashboardData(); // Refresh lists
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast('Texto da mensagem copiado para a área de transferência!');
  };

  if (loading) {
    return <div className="text-center" style={{ padding: '60px' }}>Carregando estatísticas...</div>;
  }

  return (
    <div>
      {/* KPIs Row */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>📅</div>
          <div className="kpi-data">
            <span className="kpi-val">{kpis.todayCount}</span>
            <span className="kpi-label">Atendimentos Hoje</span>
          </div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateToTab('lista-espera')}>
          <div className="kpi-icon" style={{ backgroundColor: 'var(--secondary-light)', color: 'var(--secondary)' }}>⏳</div>
          <div className="kpi-data">
            <span className="kpi-val">{kpis.waitingCount}</span>
            <span className="kpi-label">Fila de Espera</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>⚠️</div>
          <div className="kpi-data">
            <span className="kpi-val">{kpis.cancelledToday}</span>
            <span className="kpi-label">Cancelamentos Hoje</span>
          </div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateToTab('usuarios')}>
          <div className="kpi-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>👥</div>
          <div className="kpi-data">
            <span className="kpi-val">{kpis.volunteersCount}</span>
            <span className="kpi-label">Voluntários Ativos</span>
          </div>
        </div>
      </div>

      {/* Warnings & Alerts Grid */}
      <div className="alert-section">
        
        {/* Cancellations needing warning */}
        <div className="alert-panel">
          <div className="alert-panel-header">
            <h3><span>🔔</span> Cancelamentos Pendentes de Aviso</h3>
            <span className="badge badge-falta" style={{ fontSize: '0.7rem' }}>
              {alerts.cancelamentos.length} Pendentes
            </span>
          </div>
          <div className="alert-list">
            {alerts.cancelamentos.length === 0 ? (
              <div className="alert-empty">Não há cancelamentos novos para avisar.</div>
            ) : (
              alerts.cancelamentos.map((item) => (
                <div key={item.id} className={`alert-item ${item.urgente ? 'priority' : ''}`}>
                  <div className="alert-item-header">
                    <div>
                      <div className="alert-item-title">
                        {item.urgente && <span style={{ color: 'var(--status-falta)', marginRight: '4px' }}>🚨 [CRÍTICO]</span>}
                        {item.paciente_nome}
                      </div>
                      <div className="alert-item-subtitle">
                        Voluntário(a): <b>{item.voluntario_nome}</b><br />
                        Data: {item.data.split('-').reverse().join('/')} às {item.hora}
                      </div>
                    </div>
                    {item.urgente && (
                      <span className="badge badge-falta" style={{ fontSize: '0.65rem', animation: 'fadeIn 1s infinite alternate' }}>
                        &lt; 2h antecedência
                      </span>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '0.78rem', color: '#64748b', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #cbd5e1' }}>
                    📝 Motivo: {item.observacoes || 'Não informado'}
                  </div>

                  <div className="alert-item-actions">
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => copyToClipboard(item.whatsappText)}
                      title="Copiar texto para colar no WhatsApp"
                    >
                      📋 Copiar texto
                    </button>
                    <a
                      href={item.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-small"
                      style={{ textDecoration: 'none' }}
                    >
                      💬 Enviar WhatsApp
                    </a>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => handleAvisarPaciente(item.id)}
                    >
                      ✓ Resolvido
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming appointments needing confirmation */}
        <div className="alert-panel">
          <div className="alert-panel-header">
            <h3><span>✅</span> Confirmações de Hoje e Amanhã</h3>
            <span className="badge badge-agendado" style={{ fontSize: '0.7rem' }}>
              {alerts.confirmacoes.length} Agendados
            </span>
          </div>
          <div className="alert-list">
            {alerts.confirmacoes.length === 0 ? (
              <div className="alert-empty">Todos os atendimentos próximos foram confirmados!</div>
            ) : (
              alerts.confirmacoes.map((item) => (
                <div key={item.id} className="alert-item">
                  <div className="alert-item-header">
                    <div>
                      <div className="alert-item-title">{item.paciente_nome}</div>
                      <div className="alert-item-subtitle">
                        Voluntário(a): <b>{item.voluntario_nome}</b><br />
                        Horário: {item.data === new Date().toISOString().split('T')[0] ? 'Hoje' : 'Amanhã'}, {item.data.split('-').reverse().join('/')} às {item.hora}
                      </div>
                    </div>
                  </div>

                  <div className="alert-item-actions">
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => copyToClipboard(item.whatsappText)}
                      title="Copiar mensagem de confirmação"
                    >
                      📋 Copiar texto
                    </button>
                    <a
                      href={item.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-small"
                      style={{ textDecoration: 'none' }}
                    >
                      💬 Enviar WhatsApp
                    </a>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => handleConfirmarPresenca(item.id)}
                    >
                      ✓ Confirmado
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
