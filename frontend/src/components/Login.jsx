import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !senha) {
      setError('Por favor, insira o email e a senha.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao fazer login.');
      }

      onLoginSuccess(data.token, data.usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">⚓</div>
          <h1>Agenda Farol</h1>
          <span>Painel de Controle Interno</span>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              backgroundColor: 'var(--status-falta-bg)',
              color: 'var(--status-falta)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginBottom: '20px',
              border: '1px solid #fecaca'
            }}>
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">E-mail Corporativo</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="exemplo@farol.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="senha">Senha de Acesso</label>
            <input
              id="senha"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', height: '44px' }}
            disabled={loading}
          >
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          Dica para testes:<br/>
          Admin: <b>analia@farol.org</b> (senha: <b>farol123</b>)<br/>
          Voluntário: <b>marly@farol.org</b> (senha: <b>marly123</b>)
        </div>
      </div>
    </div>
  );
}
