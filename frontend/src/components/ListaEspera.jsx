import React, { useState, useEffect } from 'react';

export default function ListaEspera({ token, toast, onConvertToAppointment }) {
  const [waitlist, setWaitlist] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [obs, setObs] = useState('');

  const loadWaitlist = async () => {
    try {
      const res = await fetch('/api/lista-espera', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setWaitlist(data);
    } catch (err) {
      toast('Erro ao buscar lista de espera: ' + err.message, 'error');
    }
  };

  const loadPatients = async () => {
    try {
      const res = await fetch('/api/pacientes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Only show patients not already on the waitlist
        const waitlistPatientIds = waitlist.map(w => w.paciente_id);
        const filtered = data.filter(p => !waitlistPatientIds.includes(p.id));
        setPatients(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadWaitlist();
  }, [token]);

  useEffect(() => {
    if (showAddModal) {
      loadPatients();
    }
  }, [showAddModal, waitlist]);

  const handleOpenAddModal = () => {
    setSelectedPatientId('');
    setObs('');
    setShowAddModal(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast('Selecione um paciente.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/lista-espera', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paciente_id: selectedPatientId, observacoes: obs })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar na lista.');

      toast('Paciente adicionado à lista de espera!');
      setShowAddModal(false);
      loadWaitlist();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remover este paciente da lista de espera?')) return;

    try {
      const res = await fetch(`/api/lista-espera/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao remover da lista.');
      toast('Paciente removido da fila.');
      loadWaitlist();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="search-bar-container">
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          ➕ Adicionar à Lista de Espera
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Posição</th>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Idade</th>
              <th>Data de Entrada</th>
              <th>Observações / Preferências</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {waitlist.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center" style={{ color: 'var(--text-muted)' }}>
                  A lista de espera está vazia no momento.
                </td>
              </tr>
            ) : (
              waitlist.map((item, index) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 700, color: 'var(--primary)', width: '80px' }}>
                    #{index + 1}
                  </td>
                  <td style={{ fontWeight: 600 }}>{item.paciente_nome}</td>
                  <td>{item.paciente_telefone}</td>
                  <td>{item.paciente_idade ? `${item.paciente_idade} anos` : '-'}</td>
                  <td>
                    {new Date(item.data_solicitacao.replace(' ', 'T')).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.observacoes}>
                    {item.observacoes || '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => onConvertToAppointment(item.paciente_id, item.paciente_nome)}
                      >
                        📅 Agendar Horário
                      </button>
                      <button
                        className="btn btn-outline btn-danger btn-small"
                        onClick={() => handleRemove(item.id)}
                      >
                        🗑 Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ADD TO WAITLIST MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Adicionar à Lista de Espera</h3>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Selecione o Paciente *</label>
                  <select
                    className="form-control"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    required
                  >
                    <option value="">-- Selecione o Paciente --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome} {p.idade ? `(${p.idade} anos)` : ''}
                      </option>
                    ))}
                  </select>
                  {patients.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--status-falta)', marginTop: '6px' }}>
                      Aviso: Todos os pacientes cadastrados já estão na lista de espera ou nenhum paciente está cadastrado.
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Observações / Preferência de Dia ou Horário</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex: Prefere segundas à tarde, vaga urgente, etc."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={patients.length === 0}>Adicionar na Fila</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
