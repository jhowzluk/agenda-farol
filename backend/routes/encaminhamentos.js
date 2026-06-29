import express from 'express';
import { dbRun } from '../database.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// --- CADASTRO ---
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { paciente_id, voluntario_origem_id, voluntario_destino_id, observacoes } = req.body;

  if (!paciente_id || !voluntario_origem_id || !voluntario_destino_id) {
    return res.status(400).json({ error: 'Campos insuficientes.' });
  }

  try {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await dbRun(
      'INSERT INTO encaminhamentos (paciente_id, voluntario_origem_id, voluntario_destino_id, data_encaminhamento, observacoes) VALUES (?, ?, ?, ?, ?)',
      [paciente_id, voluntario_origem_id, voluntario_destino_id, nowStr, observacoes]
    );

    const note = `Encaminhado por voluntário origem. Obs: ${observacoes || ''}`;
    try {
      await dbRun(
        'INSERT INTO lista_espera (paciente_id, observacoes, data_solicitacao) VALUES (?, ?, ?)',
        [paciente_id, note, nowStr]
      );
    } catch (e) {
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

export default router;
