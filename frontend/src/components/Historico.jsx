import React, { useState, useEffect } from 'react';

export default function Historico({ token, toast }) {
  const [appointments, setAppointments] = useState([]);
  const [referrals, setReferrals] = useState([]);
  
  const [searchApt, setSearchApt] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [searchRef, setSearchRef] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('appointments'); // 'appointments' or 'referrals'
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/historico', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAppointments(data.appointments || []);
        setReferrals(data.referrals || []);
      } else {
        throw new Error(data.error || 'Erro ao carregar dados do histórico.');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  // Filtering appointments
  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = 
      apt.paciente_nome.toLowerCase().includes(searchApt.toLowerCase()) ||
      apt.voluntario_nome.toLowerCase().includes(searchApt.toLowerCase());
    
    const matchesStatus = statusFilter === '' || apt.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Filtering referrals
  const filteredReferrals = referrals.filter(ref => {
    return (
      ref.paciente_nome.toLowerCase().includes(searchRef.toLowerCase()) ||
      ref.origem_nome.toLowerCase().includes(searchRef.toLowerCase()) ||
      ref.destino_nome.toLowerCase().includes(searchRef.toLowerCase())
    );
  });

  if (loading) {
    return <div className="text-center" style={{ padding: '60px' }}>Carregando histórico...</div>;
  }

  return (
    <div>
      {/* Sub tabs selector */}
      <div className="calendar-filters" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button
          className={`btn ${activeSubTab === 'appointments' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('appointments')}
        >
          📅 Histórico de Atendimentos
        </button>
        <button
          className={`btn ${activeSubTab === 'referrals' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('referrals')}
        >
          🔁 Histórico de Encaminhamentos
        </button>
      </div>

      {activeSubTab === 'appointments' ? (
        // APPOINTMENTS HISTORY
        <div>
          <div className="search-bar-container">
            <input
              type="text"
              className="form-control search-input"
              placeholder="🔍 Filtrar por Paciente ou Voluntário..."
              value={searchApt}
              onChange={(e) => setSearchApt(e.target.value)}
            />
            
            <select
              className="form-control"
              style={{ maxWidth: '200px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">-- Todos os Status --</option>
              <option value="agendado">Agendado</option>
              <option value="confirmado">Confirmado</option>
              <option value="compareceu">Compareceu</option>
              <option value="falta">Falta</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Paciente</th>
                  <th>Voluntário</th>
                  <th>Status</th>
                  <th>Encaminhado Por</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center" style={{ color: 'var(--text-muted)' }}>
                      Nenhum atendimento registrado com estes filtros.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map(apt => (
                    <tr key={apt.id}>
                      <td>
                        <b>{apt.data.split('-').reverse().join('/')}</b> às {apt.hora}
                      </td>
                      <td style={{ fontWeight: 600 }}>{apt.paciente_nome}</td>
                      <td>{apt.voluntario_nome}</td>
                      <td>
                        <span className={`badge badge-${apt.status}`}>
                          {apt.status}
                        </span>
                      </td>
                      <td>{apt.encaminhado_por_nome || '-'}</td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={apt.observacoes}>
                        {apt.observacoes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // REFERRALS HISTORY
        <div>
          <div className="search-bar-container">
            <input
              type="text"
              className="form-control search-input"
              placeholder="🔍 Buscar por Paciente, Origem ou Destino..."
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
            />
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Voluntário Origem</th>
                  <th>Voluntário Destino</th>
                  <th>Observações/Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center" style={{ color: 'var(--text-muted)' }}>
                      Nenhum histórico de encaminhamento localizado.
                    </td>
                  </tr>
                ) : (
                  filteredReferrals.map(ref => (
                    <tr key={ref.id}>
                      <td>
                        {new Date(ref.data_encaminhamento.replace(' ', 'T')).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ fontWeight: 600 }}>{ref.paciente_nome}</td>
                      <td>{ref.origem_nome}</td>
                      <td>{ref.destino_nome}</td>
                      <td>{ref.observacoes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
