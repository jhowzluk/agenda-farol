import express from 'express';
import { dbAll, dbRun } from '../database.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// --- LISTAGEM DE AVISOS ---
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // 1. Cancellations needing notice
    const rawCancellations = await dbAll(`
      SELECT a.*, p.nome as paciente_nome, p.telefone as paciente_telefone, u.nome as voluntario_nome
      FROM atendimentos a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN usuarios u ON a.voluntario_id = u.id
      WHERE a.status = 'cancelado' AND a.paciente_avisado = 0
    `);

    const cancelamentos = rawCancellations.map(c => {
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

      const text = `Olá, ${c.paciente_nome}! Informamos que seu atendimento agendado com o(a) voluntário(a) ${c.voluntario_nome} no dia ${c.data.split('-').reverse().join('/')} às ${c.hora} foi cancelado. Pedimos desculpas pelo transtorno e entraremos em contato em breve para remarcar.`;
      const waLink = `https://api.whatsapp.com/send?phone=55${c.paciente_telefone.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`;

      return {
        ...c,
        urgente,
        whatsappText: text,
        whatsappLink: waLink
      };
    });

    // 2. Pending Confirmations
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

// --- MARCAR AVISADO ---
router.post('/:id/avisado', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("UPDATE atendimentos SET paciente_avisado = 1 WHERE id = ?", [id]);
    res.json({ message: 'Paciente marcado como avisado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
