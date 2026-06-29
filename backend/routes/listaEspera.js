import express from 'express';
import { dbAll, dbRun } from '../database.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// --- LISTAGEM ---
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
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

// --- ADICIONAR ---
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
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

// --- REMOVER ---
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM lista_espera WHERE id = ?', [req.params.id]);
    res.json({ message: 'Paciente removido da lista de espera.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
