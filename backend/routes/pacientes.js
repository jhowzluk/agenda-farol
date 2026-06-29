import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// --- LISTAGEM ---
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
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

// --- CADASTRO ---
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { nome, telefone, idade, responsavel, observacoes } = req.body;

  if (!nome || nome.trim().length < 3 || /^\d+$/.test(nome.trim())) {
    return res.status(400).json({ error: 'Nome inválido. Deve conter pelo menos 3 caracteres e não ser apenas números.' });
  }
  if (!telefone || telefone.trim().length < 8) {
    return res.status(400).json({ error: 'Telefone inválido. Deve conter pelo menos 8 dígitos.' });
  }

  if (responsavel && responsavel.trim() !== '') {
    if (responsavel.trim().length < 3 || /^\d+$/.test(responsavel.trim())) {
      return res.status(400).json({ error: 'O nome do responsável deve ser válido (mínimo 3 caracteres e não conter apenas números).' });
    }
  }

  const numIdade = parseInt(idade);
  if (!isNaN(numIdade)) {
    if (numIdade < 0 || numIdade > 120) {
      return res.status(400).json({ error: 'A idade deve ser um número entre 0 e 120.' });
    }
    if (numIdade < 18 && (!responsavel || responsavel.trim() === '')) {
      return res.status(400).json({ error: 'Para menores de 18 anos, é obrigatório registrar um responsável.' });
    }
  }

  try {
    const result = await dbRun(
      'INSERT INTO pacientes (nome, telefone, idade, responsavel, observacoes) VALUES (?, ?, ?, ?, ?)',
      [nome, telefone, isNaN(numIdade) ? null : numIdade, responsavel || null, observacoes]
    );
    res.status(201).json({ id: result.id, nome, telefone, idade: isNaN(numIdade) ? null : numIdade, responsavel, observacoes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- EDIÇÃO ---
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { nome, telefone, idade, responsavel, observacoes } = req.body;
  const { id } = req.params;

  if (!nome || nome.trim().length < 3 || /^\d+$/.test(nome.trim())) {
    return res.status(400).json({ error: 'Nome inválido. Deve conter pelo menos 3 caracteres e não ser apenas números.' });
  }
  if (!telefone || telefone.trim().length < 8) {
    return res.status(400).json({ error: 'Telefone inválido. Deve conter pelo menos 8 dígitos.' });
  }

  if (responsavel && responsavel.trim() !== '') {
    if (responsavel.trim().length < 3 || /^\d+$/.test(responsavel.trim())) {
      return res.status(400).json({ error: 'O nome do responsável deve ser válido (mínimo 3 caracteres e não conter apenas números).' });
    }
  }

  const numIdade = parseInt(idade);
  if (!isNaN(numIdade)) {
    if (numIdade < 0 || numIdade > 120) {
      return res.status(400).json({ error: 'A idade deve ser um número entre 0 e 120.' });
    }
    if (numIdade < 18 && (!responsavel || responsavel.trim() === '')) {
      return res.status(400).json({ error: 'Para menores de 18 anos, é obrigatório registrar um responsável.' });
    }
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

// --- EXCLUSÃO ---
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM pacientes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Paciente removido com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- HISTÓRICO ---
router.get('/:id/historico', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const appointments = await dbAll(
      `SELECT a.*, u.nome as voluntario_nome 
       FROM atendimentos a 
       JOIN usuarios u ON a.voluntario_id = u.id 
       WHERE a.paciente_id = ? 
       ORDER BY a.data DESC, a.hora DESC`,
      [id]
    );

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

export default router;
