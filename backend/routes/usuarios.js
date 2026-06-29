import express from 'express';
import bcryptjs from 'bcryptjs';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// --- LISTAGEM ---
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await dbAll('SELECT id, nome, email, tipo, especialidade, limite_diario, limite_mensal, ativo FROM usuarios');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CADASTRO ---
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { nome, email, senha, tipo, especialidade, limite_diario, limite_mensal } = req.body;

  if (!nome || !email || !senha || !tipo) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (Nome, E-mail, Senha, Tipo).' });
  }

  try {
    const salt = await bcryptjs.genSalt(10);
    const hashPassword = await bcryptjs.hash(senha, salt);

    const result = await dbRun(
      'INSERT INTO usuarios (nome, email, senha, tipo, especialidade, limite_diario, limite_mensal) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        nome,
        email,
        hashPassword,
        tipo,
        especialidade || null,
        limite_diario ? parseInt(limite_diario) : null,
        limite_mensal ? parseInt(limite_mensal) : null
      ]
    );

    res.status(201).json({ id: result.id, nome, email, tipo });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed') || error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// --- EDIÇÃO ---
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { nome, email, senha, tipo, especialidade, limite_diario, limite_mensal, ativo } = req.body;
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado.' });

    if (parseInt(id) === parseInt(req.user.id) && tipo && tipo !== existing.tipo) {
      return res.status(400).json({ error: 'Você não pode alterar o seu próprio nível de acesso (tipo).' });
    }
    if (parseInt(id) === parseInt(req.user.id) && ativo !== undefined && parseInt(ativo) === 0) {
      return res.status(400).json({ error: 'Você não pode desativar o seu próprio usuário.' });
    }

    let sql = 'UPDATE usuarios SET nome = ?, email = ?, tipo = ?, especialidade = ?, limite_diario = ?, limite_mensal = ?, ativo = ?';
    let params = [
      nome || existing.nome,
      email || existing.email,
      tipo || existing.tipo,
      especialidade !== undefined ? especialidade : existing.especialidade,
      limite_diario !== undefined ? limite_diario : existing.limite_diario,
      limite_mensal !== undefined ? limite_mensal : existing.limite_mensal,
      ativo !== undefined ? ativo : existing.ativo
    ];

    if (senha) {
      const salt = await bcryptjs.genSalt(10);
      const hashPassword = await bcryptjs.hash(senha, salt);
      sql += ', senha = ?';
      params.push(hashPassword);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await dbRun(sql, params);
    res.json({ message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed') || error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado por outro usuário.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// --- EXCLUSÃO (INATIVAÇÃO LÓGICA) ---
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === parseInt(req.user.id)) {
      return res.status(400).json({ error: 'Você não pode desativar o seu próprio usuário.' });
    }
    await dbRun('UPDATE usuarios SET ativo = 0 WHERE id = ?', [id]);
    res.json({ message: 'Usuário desativado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- DISPONIBILIDADES ---
router.get('/:id/disponibilidades', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (req.user.tipo === 'voluntario' && parseInt(id) !== req.user.id) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  try {
    const list = await dbAll('SELECT * FROM disponibilidades WHERE voluntario_id = ? ORDER BY dia_semana ASC, hora_inicio ASC', [id]);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/disponibilidades', authenticateToken, requireAdmin, async (req, res) => {
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

router.delete('/disponibilidades/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM disponibilidades WHERE id = ?', [req.params.id]);
    res.json({ message: 'Disponibilidade removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BLOQUEIOS HORÁRIO ---
router.get('/:id/bloqueios', authenticateToken, async (req, res) => {
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

router.post('/:id/bloqueios', authenticateToken, requireAdmin, async (req, res) => {
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

router.delete('/bloqueios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM bloqueios_horario WHERE id = ?', [req.params.id]);
    res.json({ message: 'Bloqueio de horário removido.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
