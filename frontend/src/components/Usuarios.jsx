import React, { useState, useEffect } from 'react';

export default function Usuarios({ token, usuario, toast }) {
  const [users, setUsers] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);

  // Form user states
  const [formData, setFormData] = useState({
    id: null,
    nome: '',
    email: '',
    senha: '',
    tipo: 'voluntario',
    limite_diario: '',
    limite_mensal: ''
  });

  // Form availability states
  const [avForm, setAvForm] = useState({
    dia_semana: 1, // Monday default
    hora_inicio: '14:00',
    hora_fim: '18:00',
    recorrencia: 'semanal'
  });

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (err) {
      toast('Erro ao carregar usuários: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  const handleOpenCreateModal = () => {
    setFormData({
      id: null,
      nome: '',
      email: '',
      senha: '',
      tipo: 'voluntario',
      limite_diario: '',
      limite_mensal: ''
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (u) => {
    setFormData({
      id: u.id,
      nome: u.nome,
      email: u.email,
      senha: '', // leave empty, only set to update password
      tipo: u.tipo,
      limite_diario: u.limite_diario !== null ? u.limite_diario : '',
      limite_mensal: u.limite_mensal !== null ? u.limite_mensal : ''
    });
    setShowFormModal(true);
  };

  const handleOpenAvailability = async (user) => {
    setSelectedUser(user);
    setAvForm({
      dia_semana: 1,
      hora_inicio: '14:00',
      hora_fim: '18:00',
      recorrencia: 'semanal'
    });
    
    try {
      const res = await fetch(`/api/usuarios/${user.id}/disponibilidades`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAvailabilities(data);
        setShowAvailabilityModal(true);
      } else {
        throw new Error(data.error || 'Erro ao carregar disponibilidades.');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nome || !formData.email || (formData.id === null && !formData.senha)) {
      toast('Preencha os campos obrigatórios.', 'error');
      return;
    }

    try {
      const isEdit = formData.id !== null;
      const url = isEdit ? `/api/usuarios/${formData.id}` : '/api/usuarios';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        nome: formData.nome,
        email: formData.email,
        tipo: formData.tipo,
        limite_diario: formData.limite_diario ? parseInt(formData.limite_diario) : null,
        limite_mensal: formData.limite_mensal ? parseInt(formData.limite_mensal) : null
      };

      if (formData.senha) {
        payload.senha = formData.senha;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar usuário.');

      toast(isEdit ? 'Usuário atualizado!' : 'Usuário cadastrado com sucesso!');
      setShowFormModal(false);
      loadUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Excluir este usuário permanentemente?')) return;

    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir usuário.');
      toast('Usuário removido do sistema.');
      loadUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Add Availability
  const handleAddAvailability = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await fetch(`/api/usuarios/${selectedUser.id}/disponibilidades`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(avForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar disponibilidade.');

      toast('Disponibilidade adicionada!');
      
      // Refresh list
      const updatedRes = await fetch(`/api/usuarios/${selectedUser.id}/disponibilidades`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const updatedData = await updatedRes.json();
      if (updatedRes.ok) setAvailabilities(updatedData);

    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Remove Availability
  const handleRemoveAvailability = async (id) => {
    try {
      const res = await fetch(`/api/usuarios/disponibilidades/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir disponibilidade.');

      toast('Disponibilidade removida.');
      
      // Refresh list
      const updatedRes = await fetch(`/api/usuarios/${selectedUser.id}/disponibilidades`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const updatedData = await updatedRes.json();
      if (updatedRes.ok) setAvailabilities(updatedData);

    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const getWeekdayName = (dayNum) => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[dayNum];
  };

  return (
    <div>
      <div className="search-bar-container">
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          ＋ Cadastrar Usuário
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Limite Diário</th>
              <th>Limite Mensal</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.nome}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge ${u.tipo === 'admin' ? 'badge-confirmado' : 'badge-agendado'}`}>
                    {u.tipo === 'admin' ? 'Secretária (Admin)' : 'Voluntário'}
                  </span>
                </td>
                <td>{u.limite_diario || 'Sem limite'}</td>
                <td>{u.limite_mensal || 'Sem limite'}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {u.tipo === 'voluntario' && (
                      <button className="btn btn-secondary btn-small" onClick={() => handleOpenAvailability(u)}>
                        📅 Disponibilidade
                      </button>
                    )}
                    <button className="btn btn-outline btn-small" onClick={() => handleOpenEditModal(u)}>
                      ✏ Editar
                    </button>
                    {u.id !== usuario?.id && (
                      <button className="btn btn-outline btn-danger btn-small" onClick={() => handleDeleteUser(u.id)}>
                        🗑 Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* USER FORM MODAL */}
      {showFormModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{formData.id ? 'Editar Usuário' : 'Cadastrar Usuário'}</h3>
              <button className="modal-close-btn" onClick={() => setShowFormModal(false)}>×</button>
            </div>
            <form onSubmit={handleUserSubmit}>
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
                  <label>E-mail (Login) *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="nome@farol.org"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Senha {formData.id ? '(Deixe em branco para manter a mesma)' : '*'}</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    required={formData.id === null}
                  />
                </div>

                <div className="form-group">
                  <label>Tipo de Perfil *</label>
                  <select
                    className="form-control"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    required
                    disabled={formData.id === usuario?.id}
                  >
                    <option value="voluntario">Voluntário</option>
                    <option value="admin">Secretária (Admin)</option>
                  </select>
                  {formData.id === usuario?.id && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Você não pode alterar seu próprio perfil de acesso.
                    </span>
                  )}
                </div>

                {formData.tipo === 'voluntario' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Limite Diário de Atendimentos</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Ex: 5"
                        value={formData.limite_diario}
                        onChange={(e) => setFormData({ ...formData, limite_diario: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Limite Mensal de Atendimentos</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Ex: 2 (Caso da Thaís)"
                        value={formData.limite_mensal}
                        onChange={(e) => setFormData({ ...formData, limite_mensal: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowFormModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AVAILABILITY MODAL */}
      {showAvailabilityModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Definir Disponibilidade: {selectedUser.nome}</h3>
              <button className="modal-close-btn" onClick={() => setShowAvailabilityModal(false)}>×</button>
            </div>
            
            {/* Add availability form */}
            <form onSubmit={handleAddAvailability} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
              <div className="modal-body" style={{ paddingBottom: 0 }}>
                <h4 style={{ marginBottom: '12px' }}>Adicionar Novo Horário Recorrente</h4>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Dia da Semana</label>
                    <select
                      className="form-control"
                      value={avForm.dia_semana}
                      onChange={(e) => setAvForm({ ...avForm, dia_semana: parseInt(e.target.value) })}
                    >
                      <option value="1">Segunda-feira</option>
                      <option value="2">Terça-feira</option>
                      <option value="3">Quarta-feira</option>
                      <option value="4">Quinta-feira</option>
                      <option value="5">Sexta-feira</option>
                      <option value="6">Sábado</option>
                      <option value="0">Domingo</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Recorrência</label>
                    <select
                      className="form-control"
                      value={avForm.recorrencia}
                      onChange={(e) => setAvForm({ ...avForm, recorrencia: e.target.value })}
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quinzenal_impar">Quinzenal (Semana Ímpar)</option>
                      <option value="quinzenal_par">Quinzenal (Semana Par)</option>
                      <option value="mensal">Mensal (1ª Semana)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Hora Início</label>
                    <input
                      type="time"
                      className="form-control"
                      value={avForm.hora_inicio}
                      onChange={(e) => setAvForm({ ...avForm, hora_inicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Hora Fim</label>
                    <input
                      type="time"
                      className="form-control"
                      value={avForm.hora_fim}
                      onChange={(e) => setAvForm({ ...avForm, hora_fim: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Adicionar Horário Disponível
                </button>
              </div>
            </form>

            {/* List current availabilities */}
            <div className="modal-body" style={{ paddingTop: '20px', maxHeight: '40vh', overflowY: 'auto' }}>
              <h4 style={{ marginBottom: '12px' }}>Horários Cadastrados</h4>
              {availabilities.length === 0 ? (
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Nenhuma disponibilidade configurada para este voluntário.
                </div>
              ) : (
                <div className="availability-item-list">
                  {availabilities.map(av => (
                    <div key={av.id} className="availability-item">
                      <div>
                        <b>{getWeekdayName(av.dia_semana)}</b>: {av.hora_inicio}h às {av.hora_fim}h
                        <span className="badge badge-agendado" style={{ fontSize: '0.6rem', marginLeft: '8px' }}>
                          {av.recorrencia}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-danger btn-small"
                        onClick={() => handleRemoveAvailability(av.id)}
                        style={{ padding: '2px 8px' }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAvailabilityModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
