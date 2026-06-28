import React, { useState, useEffect } from 'react';

export default function Agenda({ token, usuario, toast, preselectedPatient, onClearPreselected }) {
  const isAdmin = usuario.tipo === 'admin';

  // State
  const [volunteers, setVolunteers] = useState([]);
  const [selectedVolId, setSelectedVolId] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState('week'); // 'day' or 'week'
  
  const [availabilities, setAvailabilities] = useState([]);
  const [blockedTimes, setBlockedTimes] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);

  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  
  // Selected slot/appointment for modals
  const [selectedSlot, setSelectedSlot] = useState(null); // { date, time }
  const [selectedApt, setSelectedApt] = useState(null); // Full appointment object
  
  // Form states
  const [bookingPatientId, setBookingPatientId] = useState('');
  const [quickPatientName, setQuickPatientName] = useState('');
  const [quickPatientPhone, setQuickPatientPhone] = useState('');
  const [quickPatientAge, setQuickPatientAge] = useState('');
  const [quickPatientResp, setQuickPatientResp] = useState('');
  const [bookingObs, setBookingObs] = useState('');
  const [bookingReferrer, setBookingReferrer] = useState('');
  const [isQuickRegister, setIsQuickRegister] = useState(false);

  const [editStatus, setEditStatus] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editObs, setEditObs] = useState('');
  const [referToVolId, setReferToVolId] = useState('');
  const [referObs, setReferObs] = useState('');
  const [isReferring, setIsReferring] = useState(false);

  const [blockData, setBlockData] = useState({
    data: '',
    hora_inicio: '08:00',
    hora_fim: '12:00',
    motivo: ''
  });

  // Fetch volunteers (if admin)
  useEffect(() => {
    const loadVolunteers = async () => {
      try {
        const res = await fetch('/api/usuarios', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          const vols = data.filter(u => u.tipo === 'voluntario');
          setVolunteers(vols);
          if (vols.length > 0) {
            setSelectedVolId(vols[0].id.toString());
          }
        }
      } catch (err) {
        toast('Erro ao buscar voluntários: ' + err.message, 'error');
      }
    };

    if (isAdmin) {
      loadVolunteers();
    } else {
      setSelectedVolId(usuario.id.toString());
    }
  }, [isAdmin, token, usuario.id]);

  // Load patients (if admin, for booking dropdown)
  const loadPatients = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/pacientes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setPatients(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [token]);

  // Fetch volunteer specific schedule data (availabilities, blocks, appointments)
  const fetchScheduleData = async () => {
    if (!selectedVolId) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Load availability
      const avRes = await fetch(`/api/usuarios/${selectedVolId}/disponibilidades`, { headers });
      const avData = await avRes.json();
      setAvailabilities(avRes.ok ? avData : []);

      // Load blocks
      const blRes = await fetch(`/api/usuarios/${selectedVolId}/bloqueios`, { headers });
      const blData = await blRes.json();
      setBlockedTimes(blRes.ok ? blData : []);

      // Load appointments for active range
      const aptRes = await fetch(`/api/atendimentos?voluntario_id=${selectedVolId}`, { headers });
      const aptData = await aptRes.json();
      setAppointments(aptRes.ok ? aptData : []);

    } catch (err) {
      toast('Erro ao carregar dados da agenda: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, [selectedVolId, token]);

  // ISO Week number helper
  const getISOWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  // Get days in active week (Monday to Sunday)
  const getWeekDays = (date) => {
    const current = new Date(date);
    const day = current.getDay();
    // Monday is day 1, Sunday is day 0
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      days.push(next);
    }
    return days;
  };

  const activeDays = viewType === 'week' ? getWeekDays(currentDate) : [new Date(currentDate)];

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() - (viewType === 'week' ? 7 : 1));
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + (viewType === 'week' ? 7 : 1));
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Recurrence logic checker: returns true if active on specific date
  const isAvailabilityActiveOnDate = (av, date) => {
    const weekday = date.getDay();
    if (av.dia_semana !== weekday) return false;

    const weekNum = getISOWeekNumber(date);
    const dayOfMonth = date.getDate();

    switch (av.recorrencia) {
      case 'semanal':
        return true;
      case 'quinzenal_impar':
        return weekNum % 2 !== 0;
      case 'quinzenal_par':
        return weekNum % 2 === 0;
      case 'mensal':
        // 1st occurrence of weekday in month (day of month <= 7)
        return dayOfMonth <= 7;
      default:
        return false;
    }
  };

  // Time slice helper: turns HH:MM window into 1-hour slots
  const sliceTimeToHours = (start, end) => {
    const slots = [];
    let [startH, startM] = start.split(':').map(Number);
    let [endH, endM] = end.split(':').map(Number);

    for (let h = startH; h < endH; h++) {
      const hourStr = String(h).padStart(2, '0') + ':00';
      slots.push(hourStr);
    }
    return slots;
  };

  // Manual block checker
  const isTimeBlocked = (volId, dateStr, hourStr) => {
    return blockedTimes.some(b => {
      return b.data === dateStr && hourStr >= b.hora_inicio && hourStr < b.hora_fim;
    });
  };

  const getBlockReason = (dateStr, hourStr) => {
    const block = blockedTimes.find(b => {
      return b.data === dateStr && hourStr >= b.hora_inicio && hourStr < b.hora_fim;
    });
    return block ? block.motivo : '';
  };

  // Combine availability rules to build day schedule grid
  // Returns sorted list of all unique 1-hour slots active on this date range
  const getHoursForDates = (dates) => {
    const allHours = new Set();
    dates.forEach(d => {
      availabilities.forEach(av => {
        if (isAvailabilityActiveOnDate(av, d)) {
          const sliced = sliceTimeToHours(av.hora_inicio, av.hora_fim);
          sliced.forEach(h => allHours.add(h));
        }
      });
    });

    // If no availabilities are defined yet, show default standard slots
    if (allHours.size === 0) {
      return ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    }

    return Array.from(allHours).sort();
  };

  const activeHours = getHoursForDates(activeDays);

  // Booking handlers
  const handleOpenBookModal = (date, hour) => {
    if (!isAdmin) return;
    setSelectedSlot({ date, time: hour });
    
    if (preselectedPatient) {
      setBookingPatientId(preselectedPatient.id.toString());
      setIsQuickRegister(false);
      setBookingObs('Agendado a partir da Lista de Espera.');
    } else {
      setBookingPatientId('');
      setIsQuickRegister(false);
      setBookingObs('');
    }

    setQuickPatientName('');
    setQuickPatientPhone('');
    setQuickPatientAge('');
    setQuickPatientResp('');
    setBookingReferrer('');
    setShowBookModal(true);
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    let patientId = bookingPatientId;
    const dateStr = selectedSlot.date.toISOString().split('T')[0];

    try {
      // Step 1: Handle quick register patient
      if (isQuickRegister) {
        if (!quickPatientName || !quickPatientPhone) {
          toast('Por favor, informe o Nome e Telefone do paciente.', 'error');
          return;
        }

        const ageNum = parseInt(quickPatientAge);
        if (!isNaN(ageNum) && ageNum < 18 && (!quickPatientResp || quickPatientResp.trim() === '')) {
          toast('Pacientes menores de 18 anos exigem um responsável registrado.', 'error');
          return;
        }

        const patientRes = await fetch('/api/pacientes', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nome: quickPatientName,
            telefone: quickPatientPhone,
            idade: quickPatientAge,
            responsavel: quickPatientResp,
            observacoes: 'Cadastro rápido via agenda.'
          })
        });
        const patientData = await patientRes.json();
        if (!patientRes.ok) throw new Error(patientData.error || 'Erro ao cadastrar paciente rápido.');
        
        patientId = patientData.id;
        toast('Paciente cadastrado com sucesso!');
        loadPatients(); // refresh list
      }

      if (!patientId) {
        toast('Selecione ou cadastre um paciente.', 'error');
        return;
      }

      // Step 2: Book appointment
      const appRes = await fetch('/api/atendimentos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paciente_id: patientId,
          voluntario_id: selectedVolId,
          data: dateStr,
          hora: selectedSlot.time,
          status: 'agendado',
          observacoes: bookingObs,
          encaminhado_por: bookingReferrer || null
        })
      });

      const appData = await appRes.json();
      if (!appRes.ok) throw new Error(appData.error || 'Erro ao agendar horário.');

      toast('Atendimento agendado com sucesso!');
      setShowBookModal(false);
      if (preselectedPatient && onClearPreselected) {
        onClearPreselected();
      }
      fetchScheduleData(); // refresh calendar
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Edit / Details handlers
  const handleOpenEditModal = (apt) => {
    if (!isAdmin) return; // Volunteer cannot click
    setSelectedApt(apt);
    setEditStatus(apt.status);
    setEditDate(apt.data);
    setEditTime(apt.hora);
    setEditObs(apt.observacoes || '');
    setReferToVolId('');
    setReferObs('');
    setIsReferring(false);
    setShowEditModal(true);
  };

  const handleUpdateAppointment = async (e) => {
    e.preventDefault();
    if (!selectedApt) return;

    try {
      const res = await fetch(`/api/atendimentos/${selectedApt.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: editStatus,
          data: editDate,
          hora: editTime,
          observacoes: editObs
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar atendimento.');

      toast('Atendimento atualizado!');
      setShowEditModal(false);
      fetchScheduleData();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleCancelAppointment = async () => {
    if (!selectedApt) return;
    try {
      const res = await fetch(`/api/atendimentos/${selectedApt.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'cancelado',
          observacoes: editObs + ' (Cancelado)'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar.');

      toast('Atendimento cancelado. O lembrete de aviso foi adicionado ao dashboard!');
      setShowEditModal(false);
      fetchScheduleData();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Forwarding / Referral handler
  const handleReferPatient = async (e) => {
    e.preventDefault();
    if (!selectedApt || !referToVolId) return;

    try {
      const res = await fetch('/api/encaminhamentos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paciente_id: selectedApt.paciente_id,
          voluntario_origem_id: selectedVolId,
          voluntario_destino_id: referToVolId,
          observacoes: referObs
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao encaminhar paciente.');

      toast('Paciente encaminhado! Adicionado à lista de espera do voluntário de destino.');
      setIsReferring(false);
      setShowEditModal(false);
      fetchScheduleData();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Block handlers
  const handleCreateBlock = async (e) => {
    e.preventDefault();
    if (!blockData.data || !blockData.hora_inicio || !blockData.hora_fim) {
      toast('Preencha todos os campos do bloqueio.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/usuarios/${selectedVolId}/bloqueios`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(blockData)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao criar bloqueio.');
      }
      toast('Horário bloqueado com sucesso!');
      setShowBlockModal(false);
      setBlockData({
        data: '',
        hora_inicio: '08:00',
        hora_fim: '12:00',
        motivo: ''
      });
      fetchScheduleData();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      {/* Calendar Navigation and Controls */}
      <div className="calendar-controls">
        <div className="calendar-filters">
          {isAdmin ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                className="form-control"
                style={{ minWidth: '240px' }}
                value={selectedVolId}
                onChange={(e) => setSelectedVolId(e.target.value)}
              >
                {volunteers.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nome} {v.especialidade ? `(${v.especialidade})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
              Agenda do Voluntário: {usuario.nome} {usuario.especialidade ? `(${usuario.especialidade})` : ''}
            </div>
          )}

          {isAdmin && (
            <button className="btn btn-secondary btn-small" onClick={() => setShowBlockModal(true)}>
              ⛔ Bloquear Horário
            </button>
          )}
        </div>

        <div className="calendar-navigation">
          <button className="btn btn-outline btn-small" onClick={handlePrev}>◀</button>
          <button className="btn btn-outline btn-small" onClick={handleToday}>Hoje</button>
          <button className="btn btn-outline btn-small" onClick={handleNext}>▶</button>
          
          <div className="calendar-date-display">
            {viewType === 'week' ? (
              <>
                Semana {getISOWeekNumber(currentDate)} ({currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})
              </>
            ) : (
              currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            )}
          </div>
        </div>

        <div className="calendar-filters">
          <button
            className={`btn btn-small ${viewType === 'day' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewType('day')}
          >
            Dia
          </button>
          <button
            className={`btn btn-small ${viewType === 'week' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewType('week')}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Calendar Grid Sheet */}
      <div className="calendar-grid">
        {/* Header cells */}
        <div className="calendar-header" style={{ gridTemplateColumns: `100px repeat(${activeDays.length}, 1fr)` }}>
          <div className="calendar-header-cell">Hora</div>
          {activeDays.map((d, index) => (
            <div key={index} className="calendar-header-cell">
              <div>{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{d.getDate()}</div>
            </div>
          ))}
        </div>

        {/* Hour Rows */}
        <div className="calendar-body">
          {activeHours.map(hour => (
            <div key={hour} className="calendar-row" style={{ gridTemplateColumns: `100px repeat(${activeDays.length}, 1fr)` }}>
              {/* Hour identifier */}
              <div className="calendar-time-cell">{hour}</div>
              
              {/* Day cells for that hour */}
              {activeDays.map((date, dIndex) => {
                const dateStr = date.toISOString().split('T')[0];
                
                // 1. Check if the volunteer is available at this hour on this date
                const isAvailable = availabilities.some(av => {
                  if (isAvailabilityActiveOnDate(av, date)) {
                    const slots = sliceTimeToHours(av.hora_inicio, av.hora_fim);
                    return slots.includes(hour);
                  }
                  return false;
                });

                // 2. Check if blocked
                const blocked = isTimeBlocked(selectedVolId, dateStr, hour);
                const blockReason = blocked ? getBlockReason(dateStr, hour) : '';

                // 3. Find booked appointment (excluding cancelled ones to free up the slot)
                const apt = appointments.find(a => a.data === dateStr && a.hora === hour && a.status !== 'cancelado');

                return (
                  <div key={dIndex} className="calendar-cell">
                    {apt ? (
                      <div
                        className={`apt-block ${apt.status}`}
                        onClick={() => handleOpenEditModal(apt)}
                      >
                        <div className="apt-time">{apt.hora}</div>
                        <div className="apt-name">{apt.paciente_nome}</div>
                        {apt.paciente_responsavel && (
                          <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                            Resp: {apt.paciente_responsavel}
                          </div>
                        )}
                        <div className="apt-vol">
                          Status: <b>{apt.status.toUpperCase()}</b>
                        </div>
                      </div>
                    ) : blocked ? (
                      <div className="slot-blocked" title={blockReason}>
                        <span>⛔ Bloqueado</span>
                        <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>{blockReason}</span>
                      </div>
                    ) : isAvailable ? (
                      <div
                        className={`slot-available ${!isAdmin ? 'readonly' : ''}`}
                        onClick={() => handleOpenBookModal(date, hour)}
                      >
                        <span>＋ Disponível</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL 1: NOVO AGENDAMENTO */}
      {showBookModal && selectedSlot && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Novo Agendamento</h3>
              <button className="modal-close-btn" onClick={() => setShowBookModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAppointment}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px', fontSize: '0.9rem', backgroundColor: 'var(--primary-light)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                  📅 <b>Data:</b> {selectedSlot.date.toLocaleDateString('pt-BR')} às {selectedSlot.time}
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>Paciente</label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                      onClick={() => setIsQuickRegister(!isQuickRegister)}
                    >
                      {isQuickRegister ? '🔍 Selecionar Existente' : '＋ Cadastrar Rápido'}
                    </button>
                  </div>

                  {isQuickRegister ? (
                    <div style={{ border: '1px solid var(--border)', padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: '#f8fafc' }}>
                      <div className="form-group">
                        <label>Nome Completo *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={quickPatientName}
                          onChange={(e) => setQuickPatientName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Telefone (WhatsApp) *</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="47999998888"
                          value={quickPatientPhone}
                          onChange={(e) => setQuickPatientPhone(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Idade (Opcional)</label>
                          <input
                            type="number"
                            className="form-control"
                            value={quickPatientAge}
                            onChange={(e) => setQuickPatientAge(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Responsável (Obrigatório se &lt; 18)</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Nome do Pai/Mãe"
                            value={quickPatientResp}
                            onChange={(e) => setQuickPatientResp(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <select
                      className="form-control"
                      value={bookingPatientId}
                      onChange={(e) => setBookingPatientId(e.target.value)}
                      required
                    >
                      <option value="">-- Selecione o Paciente --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome} {p.idade ? `(${p.idade} anos)` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label>Encaminhado Por (Opcional)</label>
                  <select
                    className="form-control"
                    value={bookingReferrer}
                    onChange={(e) => setBookingReferrer(e.target.value)}
                  >
                    <option value="">-- Não encaminhado --</option>
                    {volunteers.map(v => (
                      <option key={v.id} value={v.id}>{v.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Observações do Agendamento</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={bookingObs}
                    onChange={(e) => setBookingObs(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowBookModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agendar Horário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DETALHES / EDITAR AGENDAMENTO */}
      {showEditModal && selectedApt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Detalhes do Atendimento</h3>
              <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            
            {isReferring ? (
              // Inner Flow: Referral Form
              <form onSubmit={handleReferPatient}>
                <div className="modal-body">
                  <h4 style={{ marginBottom: '12px' }}>Encaminhar Paciente para outro Voluntário</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Encaminhando o paciente <b>{selectedApt.paciente_nome}</b> para outro profissional voluntário. O histórico de encaminhamentos ficará gravado no prontuário.
                  </p>

                  <div className="form-group">
                    <label>Voluntário Destino *</label>
                    <select
                      className="form-control"
                      value={referToVolId}
                      onChange={(e) => setReferToVolId(e.target.value)}
                      required
                    >
                      <option value="">-- Selecione o Voluntário --</option>
                      {volunteers.filter(v => v.id !== selectedApt.voluntario_id).map(v => (
                        <option key={v.id} value={v.id}>{v.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Motivo do Encaminhamento</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={referObs}
                      onChange={(e) => setReferObs(e.target.value)}
                      placeholder="Descreva o motivo clínico ou necessidade..."
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setIsReferring(false)}>Voltar</button>
                  <button type="submit" className="btn btn-secondary">Confirmar Encaminhamento</button>
                </div>
              </form>
            ) : (
              // Default Edit Form
              <form onSubmit={handleUpdateAppointment}>
                <div className="modal-body">
                  <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedApt.paciente_nome}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Telefone: <b>{selectedApt.paciente_telefone}</b> 
                      {selectedApt.paciente_idade && ` | Idade: ${selectedApt.paciente_idade} anos`}
                      {selectedApt.paciente_responsavel && ` | Responsável: ${selectedApt.paciente_responsavel}`}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Data</label>
                      <input
                        type="date"
                        className="form-control"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Hora</label>
                      <input
                        type="time"
                        className="form-control"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Presença / Status</label>
                      <select
                        className="form-control"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        required
                      >
                        <option value="agendado">Agendado</option>
                        <option value="confirmado">Confirmado</option>
                        <option value="compareceu">Compareceu</option>
                        <option value="falta">Falta</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Observações do Atendimento</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={editObs}
                      onChange={(e) => setEditObs(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline btn-danger"
                      onClick={handleCancelAppointment}
                      disabled={editStatus === 'cancelado'}
                    >
                      ❌ Cancelar Sessão
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setIsReferring(true)}>
                      🔁 Encaminhar
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Fechar</button>
                    <button type="submit" className="btn btn-primary">Salvar Alterações</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: BLOQUEIO MANUAL DE HORÁRIO */}
      {showBlockModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Bloquear Horário Manualmente</h3>
              <button className="modal-close-btn" onClick={() => setShowBlockModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateBlock}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Data *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={blockData.data}
                    onChange={(e) => setBlockData({ ...blockData, data: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Hora Início *</label>
                    <input
                      type="time"
                      className="form-control"
                      value={blockData.hora_inicio}
                      onChange={(e) => setBlockData({ ...blockData, hora_inicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Hora Fim *</label>
                    <input
                      type="time"
                      className="form-control"
                      value={blockData.hora_fim}
                      onChange={(e) => setBlockData({ ...blockData, hora_fim: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Motivo do Bloqueio (Ex: Reunião, Treinamento, Feriado)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Treinamento, Ausência, Feriado..."
                    value={blockData.motivo}
                    onChange={(e) => setBlockData({ ...blockData, motivo: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowBlockModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-danger">Confirmar Bloqueio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
