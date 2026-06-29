import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// --- LISTAGEM ---
router.get('/', authenticateToken, async (req, res) => {
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

// --- CADASTRO ---
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { paciente_id, voluntario_id, data, hora, status, observacoes, encaminhado_por } = req.body;

  if (!paciente_id || !voluntario_id || !data || !hora) {
    return res.status(400).json({ error: 'Campos obrigatórios: Paciente, Voluntário, Data e Hora.' });
  }

  try {
    const paciente = await dbGet('SELECT * FROM pacientes WHERE id = ?', [paciente_id]);
    if (!paciente) return res.status(404).json({ error: 'Paciente não cadastrado.' });
    if (paciente.idade !== null && paciente.idade < 18 && (!paciente.responsavel || paciente.responsavel.trim() === '')) {
      return res.status(400).json({ error: `Paciente menor de idade (${paciente.idade} anos) deve possuir responsável registrado.` });
    }

    const bookingDate = new Date(`${data}T00:00:00`);
    const today = new Date();
    today.setHours(0,0,0,0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + 30);

    if (bookingDate > limitDate) {
      return res.status(400).json({ error: 'Agendamentos só podem ser realizados com no máximo 30 dias de antecedência.' });
    }

    const conflict = await dbGet(
      "SELECT id FROM atendimentos WHERE voluntario_id = ? AND data = ? AND hora = ? AND status != 'cancelado'",
      [voluntario_id, data, hora]
    );
    if (conflict) {
      return res.status(400).json({ error: 'O voluntário já possui um atendimento agendado para este horário.' });
    }

    const manualBlock = await dbGet(
      'SELECT id, motivo FROM bloqueios_horario WHERE voluntario_id = ? AND data = ? AND ? >= hora_inicio AND ? < hora_fim',
      [voluntario_id, data, hora, hora]
    );
    if (manualBlock) {
      return res.status(400).json({ error: `Este horário está bloqueado pelo voluntário. Motivo: ${manualBlock.motivo || 'Sem motivo informado'}` });
    }

    const volunteer = await dbGet('SELECT * FROM usuarios WHERE id = ?', [voluntario_id]);
    if (!volunteer) return res.status(404).json({ error: 'Voluntário não encontrado.' });

    if (volunteer.limite_diario !== null) {
      const dailyCount = await dbGet(
        "SELECT COUNT(*) as count FROM atendimentos WHERE voluntario_id = ? AND data = ? AND status != 'cancelado'",
        [voluntario_id, data]
      );
      if (dailyCount.count >= volunteer.limite_diario) {
        return res.status(400).json({ error: `Limite diário do voluntário atingido (${volunteer.limite_diario} atendimentos).` });
      }
    }

    if (volunteer.limite_mensal !== null) {
      const monthPrefix = data.slice(0, 7);
      const monthlyCount = await dbGet(
        "SELECT COUNT(*) as count FROM atendimentos WHERE voluntario_id = ? AND data LIKE ? AND status != 'cancelado'",
        [voluntario_id, `${monthPrefix}%`]
      );
      if (monthlyCount.count >= volunteer.limite_mensal) {
        return res.status(400).json({ error: `Limite mensal do voluntário atingido (${volunteer.limite_mensal} atendimentos para o mês ${monthPrefix}).` });
      }
    }

    const result = await dbRun(
      'INSERT INTO atendimentos (paciente_id, voluntario_id, data, hora, status, observacoes, encaminhado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [paciente_id, voluntario_id, data, hora, status || 'agendado', observacoes, encaminhado_por || null]
    );

    await dbRun('DELETE FROM lista_espera WHERE paciente_id = ?', [paciente_id]);

    res.status(201).json({ id: result.id, paciente_id, voluntario_id, data, hora, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- EDIÇÃO ---
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
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

    const paciente = await dbGet('SELECT * FROM pacientes WHERE id = ?', [existing.paciente_id]);
    if (!paciente) return res.status(404).json({ error: 'Paciente não encontrado.' });
    if (paciente.idade !== null && paciente.idade < 18 && (!paciente.responsavel || paciente.responsavel.trim() === '')) {
      return res.status(400).json({ error: 'Menores de 18 anos exigem um responsável registrado.' });
    }

    if (updateData !== existing.data || updateHora !== existing.hora || updateVolId !== existing.voluntario_id) {
      const bookingDate = new Date(`${updateData}T00:00:00`);
      const today = new Date();
      today.setHours(0,0,0,0);
      const limitDate = new Date(today);
      limitDate.setDate(today.getDate() + 30);
      if (bookingDate > limitDate) {
        return res.status(400).json({ error: 'Agendamentos só podem ser realizados com no máximo 30 dias de antecedência.' });
      }

      const conflict = await dbGet(
        "SELECT id FROM atendimentos WHERE voluntario_id = ? AND data = ? AND hora = ? AND id != ? AND status != 'cancelado'",
        [updateVolId, updateData, updateHora, id]
      );
      if (conflict) {
        return res.status(400).json({ error: 'O voluntário já possui um atendimento agendado para este horário.' });
      }

      const manualBlock = await dbGet(
        'SELECT id, motivo FROM bloqueios_horario WHERE voluntario_id = ? AND data = ? AND ? >= hora_inicio AND ? < hora_fim',
        [updateVolId, updateData, updateHora, updateHora]
      );
      if (manualBlock) {
        return res.status(400).json({ error: `Este horário está bloqueado pelo voluntário. Motivo: ${manualBlock.motivo}` });
      }

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

    if (updateStatus === 'cancelado' && existing.status !== 'cancelado') {
      canceladoEm = new Date().toISOString();
      pacienteAvisado = 0;
    }

    await dbRun(
      'UPDATE atendimentos SET status = ?, data = ?, hora = ?, observacoes = ?, voluntario_id = ?, cancelado_em = ?, paciente_avisado = ? WHERE id = ?',
      [updateStatus, updateData, updateHora, updateObs, updateVolId, canceladoEm, pacienteAvisado, id]
    );

    res.json({ message: 'Atendimento atualizado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- EXCLUSÃO ---
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM atendimentos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Agendamento removido do sistema.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
