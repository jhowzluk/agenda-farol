import React, { useState, useEffect } from 'react';

export default function Pacientes({ token, toast }) {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [history, setHistory] = useState({ appointments: [], referrals: [] });

  // Form states
  const [formData, setFormData] = useState({
    id: null,
    nome: '',
    telefone: '',
    idade: '',
    responsavel: '',
    observacoes: ''
  });

  const loadPatients = async () => {
    try {
      const res = await fetch(`/api/pacientes?busca=${search}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setPatients(data);
    } catch (err) {
      toast('Erro ao buscar pacientes: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    loadPatients();
  }, [search, token]);

  const handleOpenCreateModal = () => {
    setFormData({
      id: null,
      nome: '',
      telefone: '',
      idade: '',
      responsavel: '',
      observacoes: ''
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (p) => {
    setFormData({
      id: p.id,
      nome: p.nome,
      telefone: p.telefone,
      idade: p.idade || '',
      responsavel: p.responsavel || '',
      observacoes: p.observacoes || ''
    });
    setShowFormModal(true);
  };

  const handleOpenHistoryModal = async (p) => {
    setSelectedPatient(p);
    try {
      const res = await fetch(`/api/pacientes/${p.id}/historico`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data);
        setShowHistoryModal(true);
      } else {
        throw new Error(data.error || 'Erro ao carregar histórico.');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nome || formData.nome.trim().length < 3 || /^\d+$/.test(formData.nome.trim())) {
      toast('Nome inválido. Deve conter pelo menos 3 caracteres e não ser apenas números.', 'error');
      return;
    }
    if (!formData.telefone || formData.telefone.trim().length < 8) {
      toast('Telefone inválido. Deve conter pelo menos 8 dígitos.', 'error');
      return;
    }

    const ageNum = parseInt(formData.idade);
    if (!isNaN(ageNum)) {
      if (ageNum < 0 || ageNum > 120) {
        toast('A idade deve ser um número entre 0 e 120.', 'error');
        return;
      }
      if (ageNum < 18 && (!formData.responsavel || formData.responsavel.trim().length < 3 || /^\d+$/.test(formData.responsavel.trim()))) {
        toast('Para menores de 18 anos, é obrigatório registrar um responsável com nome válido (mínimo 3 caracteres).', 'error');
        return;
      }
    }

    try {
      const isEdit = formData.id !== null;
      const url = isEdit ? `/api/pacientes/${formData.id}` : '/api/pacientes';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: formData.nome,
          telefone: formData.telefone,
          idade: formData.idade ? parseInt(formData.idade) : null,
          responsavel: formData.responsavel,
          observacoes: formData.observacoes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar paciente.');

      toast(isEdit ? 'Paciente atualizado!' : 'Paciente cadastrado com sucesso!');
      setShowFormModal(false);
      loadPatients();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este paciente? Todos os agendamentos vinculados a ele também serão excluídos.')) {
      return;
    }

    try {
      const res = await fetch(`/api/pacientes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir paciente.');
      toast('Paciente excluído.');
      loadPatients();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="search-bar-container">
        <input
          type="text"
          className="form-control search-input"
          placeholder="🔍 Buscar paciente por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          ＋ Cadastrar Paciente
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Idade</th>
              <th>Responsável</th>
              <th>Observações</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center" style={{ color: 'var(--text-muted)' }}>
                  Nenhum paciente cadastrado ou encontrado.
                </td>
              </tr>
            ) : (
              patients.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.nome}</td>
                  <td>{p.telefone}</td>
                  <td>{p.idade ? `${p.idade} anos` : '-'}</td>
                  <td>{p.responsavel || '-'}</td>
                  <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.observacoes}>
                    {p.observacoes || '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-small" onClick={() => handleOpenHistoryModal(p)}>
                        📜 Histórico
                      </button>
                      <button className="btn btn-outline btn-small" onClick={() => handleOpenEditModal(p)}>
                        ✏ Editar
                      </button>
                      <button className="btn btn-outline btn-danger btn-small" onClick={() => handleDelete(p.id)}>
                        🗑 Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FORM MODAL (CREATE / EDIT) */}
      {showFormModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{formData.id ? 'Editar Paciente' : 'Cadastrar Paciente'}</h3>
              <button className="modal-close-btn" onClick={() => setShowFormModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nome Completo *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Telefone (WhatsApp) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="47999998888"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Idade (Opcional)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.idade}
                      onChange={(e) => setFormData({ ...formData, idade: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Responsável (Obrigatório se &lt; 18 anos)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nome do Pai/Mãe/Tutor"
                      value={formData.responsavel}
                      onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Observações Gerais</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Endereço, histórico de saúde relevante, etc."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowFormModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Paciente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY DETAILS MODAL */}
      {showHistoryModal && selectedPatient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>Prontuário & Histórico de Atendimentos</h3>
              <button className="modal-close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedPatient.nome}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Telefone: <b>{selectedPatient.telefone}</b> {selectedPatient.idade ? `| Idade: ${selectedPatient.idade} anos` : ''} {selectedPatient.responsavel ? `| Resp: ${selectedPatient.responsavel}` : ''}
                </div>
                {selectedPatient.observacoes && (
                  <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-main)', background: '#f8fafc', padding: '10px', borderRadius: '4px' }}>
                    💡 <b>Observações do Cadastro:</b> {selectedPatient.observacoes}
                  </div>
                )}
              </div>

              <div className="history-section">
                {/* 1. Appointments timeline */}
                <div>
                  <h4 style={{ marginBottom: '12px', borderBottom: '2px solid var(--primary-light)', paddingBottom: '4px' }}>📅 Registro de Sessões</h4>
                  {history.appointments.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Nenhum atendimento registrado anteriormente.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {history.appointments.map(apt => (
                        <div key={apt.id} className={`card history-card ${apt.status}`} style={{ margin: 0, padding: '12px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{apt.data.split('-').reverse().join('/')} às {apt.hora}</span>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                com {apt.voluntario_nome}
                              </span>
                            </div>
                            <span className={`badge badge-${apt.status}`} style={{ fontSize: '0.65rem' }}>{apt.status}</span>
                          </div>
                          {apt.observacoes && (
                            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '6px', background: '#f8fafc', padding: '6px', borderRadius: '4px' }}>
                              📝 {apt.observacoes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Referral records */}
                <div>
                  <h4 style={{ marginBottom: '12px', borderBottom: '2px solid var(--primary-light)', paddingBottom: '4px' }}>🔁 Histórico de Encaminhamentos</h4>
                  {history.referrals.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Nenhum encaminhamento registrado.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {history.referrals.map(ref => (
                        <div key={ref.id} className="card" style={{ margin: 0, padding: '12px 16px', backgroundColor: '#f8fafc' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            <span>🔄 De {ref.origem_name || ref.origem_nome} para {ref.destino_name || ref.destino_nome}</span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{ref.data_encaminhamento.split(' ')[0].split('-').reverse().join('/')}</span>
                          </div>
                          {ref.observacoes && (
                            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '6px', fontStyle: 'italic' }}>
                              &quot;{ref.observacoes}&quot;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowHistoryModal(false)}>Fechar Prontuário</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
