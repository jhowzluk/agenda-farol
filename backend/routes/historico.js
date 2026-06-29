import express from 'express';
import { dbAll } from '../database.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// --- HISTÓRICO GERAL ---
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
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

export default router;
