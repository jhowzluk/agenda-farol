import express from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet } from '../database.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// --- LOGIN ---
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const user = await dbGet('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    if (user.ativo === 0) {
      return res.status(403).json({ error: 'Este usuário está desativado. Entre em contato com a coordenação.' });
    }

    const validPassword = await bcryptjs.compare(senha, user.senha);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo },
      process.env.JWT_SECRET || 'farol_agenda_secret_token_key_2026',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        tipo: user.tipo,
        especialidade: user.especialidade
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ME ---
router.get('/me', authenticateToken, (req, res) => {
  res.json({ usuario: req.user });
});

export default router;
