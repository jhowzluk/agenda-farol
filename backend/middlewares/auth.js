import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'farol_agenda_secret_token_key_2026', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.tipo !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
};
