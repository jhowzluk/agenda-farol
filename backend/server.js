import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import { dbRun, dbAll, dbGet, initializeDatabase } from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'farol_agenda_secret_token_key_2026';

app.use(cors());
app.use(express.json());

// Initialize database tables
initializeDatabase();

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token de acesso não fornecido.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.tipo !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
  }
  next();
};

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: 'Preencha o email e a senha.' });
  }

  try {
    const user = await dbGet('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const validPassword = await bcryptjs.compare(senha, user.senha);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      usuario: { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo, especialidade: user.especialidade }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ usuario: req.user });
});

// --- USUARIOS (CRUD) ---
app.get('/api/usuarios', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await dbAll('SELECT id, nome, email, tipo, especialidade, limite_diario, limite_mensal FROM usuarios');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/usuarios', authenticateToken, requireAdmin, async (req, res) => {
  const { nome, email, senha, tipo, especialidade, limite_diario, limite_mensal } = req.body;
  if (!nome || !email || !senha || !tipo) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (nome, email, senha, tipo).' });
  }

  try {
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(senha, salt);

    const result = await dbRun(
      'INSERT INTO usuarios (nome, email, senha, tipo, especialidade, limite_diario, limite_mensal) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nome, email, hashedPassword, tipo, especialidade || null, limite_diario || null, limite_mensal || null]
    );

    res.status(201).json({ id: result.id, nome, email, tipo, especialidade });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed') || error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Este email já está em uso.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { nome, email, senha, tipo, especialidade, limite_diario, limite_mensal } = req.body;
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Don't let admin change their own role (tipo)
    if (parseInt(id) === parseInt(req.user.id) && tipo && tipo !== existing.tipo) {
      return res.status(400).json({ error: 'Você não pode alterar o seu próprio nível de acesso (tipo).' });
    }

    let sql = 'UPDATE usuarios SET nome = ?, email = ?, tipo = ?, especialidade = ?, limite_diario = ?, limite_mensal = ?';
    let params = [
      nome || existing.nome,
      email || existing.email,
      tipo || existing.tipo,
      especialidade !== undefined ? especialidade : existing.especialidade,
      limite_diario !== undefined ? limite_diario : existing.limite_diario,
      limite_mensal !== undefined ? limite_mensal : existing.limite_mensal
    ];

    if (senha) {
      const salt = await bcryptjs.genSalt(10);
      const hashedPassword = await bcryptjs.hash(senha, salt);
      sql += ', senha = ?';
      params.push(hashedPassword);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await dbRun(sql, params);
    res.json({ message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed') || error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Este email já está em uso.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Don't let admin delete their own user
    if (parseInt(id) === parseInt(req.user.id)) {
      return res.status(400).json({ error: 'Você não pode excluir o seu próprio usuário.' });
    }
    await dbRun('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Usuário removido com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- DISPONIBILIDADES ---
app.get('/api/usuarios/:id/disponibilidades', authenticateToken, async (req, res) => {
  const { id } = req.params;
  // If user is volunteer, they can only view their own availability
  if (req.user.tipo === 'voluntario' && parseInt(id) !== req.user.id) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  try {
    const list = await dbAll('SELECT * FROM disponibilidades WHERE voluntario_id = ?', [id]);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/usuarios/:id/disponibilidades', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { dia_semana, hora_inicio, hora_fim, recorrencia } = req.body;

  if (dia_semana === undefined || !hora_inicio || !hora_fim || !recorrencia) {
    return res.status(400).json({ error: 'Campos incompletos.' });
  }

  try {
    const result = await dbRun(
      'INSERT INTO disponibilidades (voluntario_id, dia_semana, hora_inicio, hora_fim, recorrencia) VALUES (?, ?, ?, ?, ?)',
      [id, dia_semana, hora_inicio, hora_fim, recorrencia]
    );
    res.status(201).json({ id: result.id, voluntario_id: parseInt(id), dia_semana, hora_inicio, hora_fim, recorrencia });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuarios/disponibilidades/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM disponibilidades WHERE id = ?', [req.params.id]);
    res.json({ message: 'Disponibilidade removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BLOQUEIOS HORARIO ---
app.get('/api/usuarios/:id/bloqueios', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (req.user.tipo === 'voluntario' && parseInt(id) !== req.user.id) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  try {
    const list = await dbAll('SELECT * FROM bloqueios_horario WHERE voluntario_id = ? ORDER BY data ASC', [id]);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/usuarios/:id/bloqueios', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, hora_inicio, hora_fim, motivo } = req.body;

  if (!data || !hora_inicio || !hora_fim) {
    return res.status(400).json({ error: 'Preencha a data e os horários de início e fim.' });
  }

  try {
    const result = await dbRun(
      'INSERT INTO bloqueios_horario (voluntario_id, data, hora_inicio, hora_fim, motivo) VALUES (?, ?, ?, ?, ?)',
      [id, data, hora_inicio, hora_fim, motivo]
    );
    res.status(201).json({ id: result.id, voluntario_id: parseInt(id), data, hora_inicio, hora_fim, motivo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuarios/bloqueios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM bloqueios_horario WHERE id = ?', [req.params.id]);
    res.json({ message: 'Bloqueio de horário removido.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PACIENTES ---
app.get('/api/pacientes', authenticateToken, requireAdmin, async (req, res) => {
  const { busca } = req.query;
  try {
    let sql = 'SELECT * FROM pacientes';
    let params = [];
    if (busca) {
      sql += ' WHERE nome LIKE ? OR telefone LIKE ?';
      params.push(`%${busca}%`, `%${busca}%`);
    }
    sql += ' ORDER BY nome ASC';
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pacientes', authenticateToken, requireAdmin, async (req, res) => {
  const { nome, telefone, idade, responsavel, observacoes } = req.body;
  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e Telefone são obrigatórios.' });
  }

  // RN06: Age restriction check
  const numIdade = parseInt(idade);
  if (!isNaN(numIdade) && numIdade < 18 && (!responsavel || responsavel.trim() === '')) {
    return res.status(400).json({ error: 'Para pacientes menores de 18 anos, é obrigatório registrar um responsável.' });
  }

  try {
    const result = await dbRun(
      'INSERT INTO pacientes (nome, telefone, idade, responsavel, observacoes) VALUES (?, ?, ?, ?, ?)',
      [nome, telefone, isNaN(numIdade) ? null : numIdade, responsavel || null, observacoes]
    );
    res.status(201).json({ id: result.id, nome, telefone, idade: numIdade, responsavel, observacoes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pacientes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { nome, telefone, idade, responsavel, observacoes } = req.body;
  const { id } = req.params;

  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e Telefone são obrigatórios.' });
  }

  // RN06: Age restriction check
  const numIdade = parseInt(idade);
  if (!isNaN(numIdade) && numIdade < 18 && (!responsavel || responsavel.trim() === '')) {
    return res.status(400).json({ error: 'Para pacientes menores de 18 anos, é obrigatório registrar um responsável.' });
  }

  try {
    await dbRun(
      'UPDATE pacientes SET nome = ?, telefone = ?, idade = ?, responsavel = ?, observacoes = ? WHERE id = ?',
      [nome, telefone, isNaN(numIdade) ? null : numIdade, responsavel || null, observacoes, id]
    );
    res.json({ message: 'Paciente atualizado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pacientes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM pacientes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Paciente removido com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pacientes/:id/historico', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Appointments history
    const appointments = await dbAll(
      `SELECT a.*, u.nome as voluntario_nome 
       FROM atendimentos a 
       JOIN usuarios u ON a.voluntario_id = u.id 
       WHERE a.paciente_id = ? 
       ORDER BY a.data DESC, a.hora DESC`,
      [id]
    );

    // 2. Referrals history
    const referrals = await dbAll(
      `SELECT e.*, uo.nome as origem_nome, ud.nome as destino_nome 
       FROM encaminhamentos e 
       JOIN usuarios uo ON e.voluntario_origem_id = uo.id 
       JOIN usuarios ud ON e.voluntario_destino_id = ud.id 
       WHERE e.paciente_id = ? 
       ORDER BY e.data_encaminhamento DESC`,
      [id]
    );

    res.json({ appointments, referrals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ATENDIMENTOS (CRUD) ---
app.get('/api/atendimentos', authenticateToken, async (req, res) => {
  const { data, voluntario_id, paciente_id } = req.query;

  try {
    let sql = `
      SELECT a.*, p.nome as paciente_nome, p.telefone as paciente_telefone, p.idade as paciente_idade, p.responsavel as paciente_responsavel, u.nome as voluntario_nome 
      FROM atendimentos a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN usuarios u ON a.voluntario_id = u.id
    `;
    let conditions = [];
    let params = [];

    // Volunteers can only see their own appointments
    if (req.user.tipo === 'voluntario') {
      conditions.push('a.voluntario_id = ?');
      params.push(req.user.id);
    } else if (voluntario_id) {
      conditions.push('a.voluntario_id = ?');
      params.push(voluntario_id);
    }

    if (data) {
      conditions.push('a.data = ?');
      params.push(data);
    }

    if (paciente_id) {
      conditions.push('a.paciente_id = ?');
      params.push(paciente_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY a.data ASC, a.hora ASC';

    const list = await dbAll(sql, params);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/atendimentos', authenticateToken, requireAdmin, async (req, res) => {
  const { paciente_id, voluntario_id, data, hora, status, observacoes, encaminhado_por } = req.body;

  if (!paciente_id || !voluntario_id || !data || !hora) {
    return res.status(400).json({ error: 'Campos obrigatórios: Paciente, Voluntário, Data e Hora.' });
  }

  try {
    // Check Patient age requirements (RN06)
    const paciente = await dbGet('SELECT * FROM pacientes WHERE id = ?', [paciente_id]);
    if (!paciente) return res.status(404).json({ error: 'Paciente não cadastrado.' });
    if (paciente.idade !== null && paciente.idade < 18 && (!paciente.responsavel || paciente.responsavel.trim() === '')) {
      return res.status(400).json({ error: `Paciente menor de idade (${paciente.idade} anos) deve possuir responsável registrado.` });
    }

    // RN10: Limit booking horizon to 30 days in advance
    const bookingDate = new Date(`${data}T00:00:00`);
    const today = new Date();
    today.setHours(0,0,0,0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + 30);

    if (bookingDate > limitDate) {
      return res.status(400).json({ error: 'Agendamentos só podem ser realizados com no máximo 30 dias de antecedência.' });
    }

    // RN08 & RN01: Block conflicts
    // Check overlapping appointments for this volunteer on the same date/time
    const conflict = await dbGet(
      "SELECT id FROM atendimentos WHERE voluntario_id = ? AND data = ? AND hora = ? AND status != 'cancelado'",
      [voluntario_id, data, hora]
    );
    if (conflict) {
      return res.status(400).json({ error: 'O voluntário já possui um atendimento agendado para este horário.' });
    }

    // Check manual block overlaps
    const manualBlock = await dbGet(
      'SELECT id, motivo FROM bloqueios_horario WHERE voluntario_id = ? AND data = ? AND ? >= hora_inicio AND ? < hora_fim',
      [voluntario_id, data, hora, hora]
    );
    if (manualBlock) {
      return res.status(400).json({ error: `Este horário está bloqueado pelo voluntário. Motivo: ${manualBlock.motivo || 'Sem motivo informado'}` });
    }

    // Check Limits (RN03 & RF17)
    const volunteer = await dbGet('SELECT * FROM usuarios WHERE id = ?', [voluntario_id]);
    if (!volunteer) return res.status(404).json({ error: 'Voluntário não encontrado.' });

    // Daily Limit
    if (volunteer.limite_diario !== null) {
      const dailyCount = await dbGet(
        "SELECT COUNT(*) as count FROM atendimentos WHERE voluntario_id = ? AND data = ? AND status != 'cancelado'",
        [voluntario_id, data]
      );
      if (dailyCount.count >= volunteer.limite_diario) {
        return res.status(400).json({ error: `Limite diário do voluntário atingido (${volunteer.limite_diario} atendimentos).` });
      }
    }

    // Monthly Limit
    if (volunteer.limite_mensal !== null) {
      const monthPrefix = data.slice(0, 7); // YYYY-MM
      const monthlyCount = await dbGet(
        "SELECT COUNT(*) as count FROM atendimentos WHERE voluntario_id = ? AND data LIKE ? AND status != 'cancelado'",
        [voluntario_id, `${monthPrefix}%`]
      );
      if (monthlyCount.count >= volunteer.limite_mensal) {
        return res.status(400).json({ error: `Limite mensal do voluntário atingido (${volunteer.limite_mensal} atendimentos para o mês ${monthPrefix}).` });
      }
    }

    // Save Appointment
    const result = await dbRun(
      'INSERT INTO atendimentos (paciente_id, voluntario_id, data, hora, status, observacoes, encaminhado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [paciente_id, voluntario_id, data, hora, status || 'agendado', observacoes, encaminhado_por || null]
    );

    // If booking was converted from the waitlist, delete it
    await dbRun('DELETE FROM lista_espera WHERE paciente_id = ?', [paciente_id]);

    res.status(201).json({ id: result.id, paciente_id, voluntario_id, data, hora, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/atendimentos/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, data, hora, observacoes, voluntario_id } = req.body;

  try {
    const existing = await dbGet('SELECT * FROM atendimentos WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Atendimento não encontrado.' });

    let updateData = data || existing.data;
    let updateHora = hora || existing.hora;
    let updateVolId = voluntario_id || existing.voluntario_id;
    let updateStatus = status || existing.status;
    let updateObs = observacoes !== undefined ? observacoes : existing.observacoes;
    let canceladoEm = existing.cancelado_em;
    let pacienteAvisado = existing.paciente_avisado;

    // Check age requirements
    const paciente = await dbGet('SELECT * FROM pacientes WHERE id = ?', [existing.paciente_id]);
    if (!paciente) return res.status(404).json({ error: 'Paciente não encontrado.' });
    if (paciente.idade !== null && paciente.idade < 18 && (!paciente.responsavel || paciente.responsavel.trim() === '')) {
      return res.status(400).json({ error: 'Menores de 18 anos exigem um responsável registrado.' });
    }

    // If date/time/volunteer changes, validate conflict & limits again
    if (updateData !== existing.data || updateHora !== existing.hora || updateVolId !== existing.voluntario_id) {
      // Limit 30 days
      const bookingDate = new Date(`${updateData}T00:00:00`);
      const today = new Date();
      today.setHours(0,0,0,0);
      const limitDate = new Date(today);
      limitDate.setDate(today.getDate() + 30);
      if (bookingDate > limitDate) {
        return res.status(400).json({ error: 'Agendamentos só podem ser realizados com no máximo 30 dias de antecedência.' });
      }

      // Conflict
      const conflict = await dbGet(
        "SELECT id FROM atendimentos WHERE voluntario_id = ? AND data = ? AND hora = ? AND id != ? AND status != 'cancelado'",
        [updateVolId, updateData, updateHora, id]
      );
      if (conflict) {
        return res.status(400).json({ error: 'O voluntário já possui um atendimento agendado para este horário.' });
      }

      // Manual Block
      const manualBlock = await dbGet(
        'SELECT id, motivo FROM bloqueios_horario WHERE voluntario_id = ? AND data = ? AND ? >= hora_inicio AND ? < hora_fim',
        [updateVolId, updateData, updateHora, updateHora]
      );
      if (manualBlock) {
        return res.status(400).json({ error: `Este horário está bloqueado pelo voluntário. Motivo: ${manualBlock.motivo}` });
      }

      // Limits
      const volunteer = await dbGet('SELECT * FROM usuarios WHERE id = ?', [updateVolId]);
      if (!volunteer) return res.status(404).json({ error: 'Voluntário não encontrado.' });
      if (volunteer.limite_diario !== null) {
        const dailyCount = await dbGet(
          "SELECT COUNT(*) as count FROM atendimentos WHERE voluntario_id = ? AND data = ? AND id != ? AND status != 'cancelado'",
          [updateVolId, updateData, id]
        );
        if (dailyCount.count >= volunteer.limite_diario) {
          return res.status(400).json({ error: `Limite diário do voluntário atingido (${volunteer.limite_diario} atendimentos).` });
        }
      }
      if (volunteer.limite_mensal !== null) {
        const monthPrefix = updateData.slice(0, 7);
        const monthlyCount = await dbGet(
          "SELECT COUNT(*) as count FROM atendimentos WHERE voluntario_id = ? AND data LIKE ? AND id != ? AND status != 'cancelado'",
          [updateVolId, `${monthPrefix}%`, id]
        );
        if (monthlyCount.count >= volunteer.limite_mensal) {
          return res.status(400).json({ error: `Limite mensal do voluntário atingido (${volunteer.limite_mensal} atendimentos).` });
        }
      }
    }

    // Trigger cancel time audit for warnings
    if (updateStatus === 'cancelado' && existing.status !== 'cancelado') {
      canceladoEm = new Date().toISOString();
      pacienteAvisado = 0; // reset warning acknowledged flag
    }

    // Update
    await dbRun(
      'UPDATE atendimentos SET status = ?, data = ?, hora = ?, observacoes = ?, voluntario_id = ?, cancelado_em = ?, paciente_avisado = ? WHERE id = ?',
      [updateStatus, updateData, updateHora, updateObs, updateVolId, canceladoEm, pacienteAvisado, id]
    );

    res.json({ message: 'Atendimento atualizado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/atendimentos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM atendimentos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Agendamento removido do sistema.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LISTA DE ESPERA ---
app.get('/api/lista-espera', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const list = await dbAll(`
      SELECT le.*, p.nome as paciente_nome, p.telefone as paciente_telefone, p.idade as paciente_idade, p.responsavel as paciente_responsavel 
      FROM lista_espera le
      JOIN pacientes p ON le.paciente_id = p.id
      ORDER BY le.data_solicitacao ASC
    `);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lista-espera', authenticateToken, requireAdmin, async (req, res) => {
  const { paciente_id, observacoes } = req.body;
  if (!paciente_id) return res.status(400).json({ error: 'Selecione um paciente.' });

  try {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const result = await dbRun(
      'INSERT INTO lista_espera (paciente_id, observacoes, data_solicitacao) VALUES (?, ?, ?)',
      [paciente_id, observacoes, nowStr]
    );
    res.status(201).json({ id: result.id, paciente_id, observacoes, data_solicitacao: nowStr });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed') || error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Este paciente já está na lista de espera.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lista-espera/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM lista_espera WHERE id = ?', [req.params.id]);
    res.json({ message: 'Paciente removido da lista de espera.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- REFERRALS (ENCAMINHAMENTOS) ---
app.post('/api/encaminhamentos', authenticateToken, requireAdmin, async (req, res) => {
  const { paciente_id, voluntario_origem_id, voluntario_destino_id, observacoes } = req.body;

  if (!paciente_id || !voluntario_origem_id || !voluntario_destino_id) {
    return res.status(400).json({ error: 'Campos insuficientes.' });
  }

  try {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    // 1. Log in forwarding table
    await dbRun(
      'INSERT INTO encaminhamentos (paciente_id, voluntario_origem_id, voluntario_destino_id, data_encaminhamento, observacoes) VALUES (?, ?, ?, ?, ?)',
      [paciente_id, voluntario_origem_id, voluntario_destino_id, nowStr, observacoes]
    );

    // 2. Put on the waitlist with notice
    const note = `Encaminhado por voluntário origem. Obs: ${observacoes || ''}`;
    try {
      await dbRun(
        'INSERT INTO lista_espera (paciente_id, observacoes, data_solicitacao) VALUES (?, ?, ?)',
        [paciente_id, note, nowStr]
      );
    } catch (e) {
      // If already on waitlist, just update observations
      await dbRun(
        'UPDATE lista_espera SET observacoes = ? WHERE paciente_id = ?',
        [note, paciente_id]
      );
    }

    res.status(201).json({ message: 'Encaminhamento registrado com sucesso e paciente colocado na fila de espera.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- AUDIT HISTORY ENDPOINT ---
app.get('/api/historico', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const appointments = await dbAll(`
      SELECT a.*, p.nome as paciente_nome, u.nome as voluntario_nome, ep.nome as encaminhado_por_nome
      FROM atendimentos a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN usuarios u ON a.voluntario_id = u.id
      LEFT JOIN usuarios ep ON a.encaminhado_por = ep.id
      ORDER BY a.data DESC, a.hora DESC
    `);

    const referrals = await dbAll(`
      SELECT e.*, p.nome as paciente_nome, uo.nome as origem_nome, ud.nome as destino_nome
      FROM encaminhamentos e
      JOIN pacientes p ON e.paciente_id = p.id
      JOIN usuarios uo ON e.voluntario_origem_id = uo.id
      JOIN usuarios ud ON e.voluntario_destino_id = ud.id
      ORDER BY e.data_encaminhamento DESC
    `);

    res.json({ appointments, referrals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- AVISOS PANEL (ALERTS) API ---
app.get('/api/avisos', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // 1. Cancellations needing notice (status = cancelado, paciente_avisado = 0)
    const rawCancellations = await dbAll(`
      SELECT a.*, p.nome as paciente_nome, p.telefone as paciente_telefone, u.nome as voluntario_nome
      FROM atendimentos a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN usuarios u ON a.voluntario_id = u.id
      WHERE a.status = 'cancelado' AND a.paciente_avisado = 0
    `);

    const cancelamentos = rawCancellations.map(c => {
      // RN05: Priority alerts for cancellations under 2 hours
      let urgente = false;
      if (c.cancelado_em) {
        const appTime = new Date(`${c.data}T${c.hora}:00`);
        const cancelTime = new Date(c.cancelado_em);
        const diffMs = appTime.getTime() - cancelTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours >= 0 && diffHours < 2) {
          urgente = true;
        }
      }

      // Generate WhatsApp text message payload
      const text = `Olá, ${c.paciente_nome}! Informamos que seu atendimento agendado com o(a) voluntário(a) ${c.voluntario_nome} no dia ${c.data.split('-').reverse().join('/')} às ${c.hora} foi cancelado. Pedimos desculpas pelo transtorno e entraremos em contato em breve para remarcar.`;
      const waLink = `https://api.whatsapp.com/send?phone=55${c.paciente_telefone.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`;

      return {
        ...c,
        urgente,
        whatsappText: text,
        whatsappLink: waLink
      };
    });

    // 2. Pending Confirmations (today or tomorrow, status = agendado)
    const rawConfirmations = await dbAll(`
      SELECT a.*, p.nome as paciente_nome, p.telefone as paciente_telefone, u.nome as voluntario_nome
      FROM atendimentos a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN usuarios u ON a.voluntario_id = u.id
      WHERE a.status = 'agendado' AND (a.data = ? OR a.data = ?)
    `, [todayStr, tomorrowStr]);

    const confirmacoes = rawConfirmations.map(c => {
      const text = `Olá, ${c.paciente_nome}! Aqui é do Agenda Farol. Confirmamos seu atendimento com o(a) voluntário(a) ${c.voluntario_nome} no dia ${c.data.split('-').reverse().join('/')} às ${c.hora}? Responda com SIM para confirmar ou NÃO se precisar desmarcar.`;
      const waLink = `https://api.whatsapp.com/send?phone=55${c.paciente_telefone.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`;

      return {
        ...c,
        whatsappText: text,
        whatsappLink: waLink
      };
    });

    res.json({ cancelamentos, confirmacoes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge alert (marks patient as notified)
app.post('/api/avisos/:id/avisado', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("UPDATE atendimentos SET paciente_avisado = 1 WHERE id = ?", [id]);
    res.json({ message: 'Paciente marcado como avisado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;
