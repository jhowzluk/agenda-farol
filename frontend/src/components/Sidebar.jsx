import React from 'react';

export default function Sidebar({ usuario, activeTab, onTabChange, onLogout }) {
  const isAdmin = usuario.tipo === 'admin';

  // Get initials for Avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside className="sidebar">
      <div>
        <div className="logo-container">
          <div className="logo-icon">⚓</div>
          <div className="logo-text">
            <h1>Agenda Farol</h1>
            <span>Controle de Atendimentos</span>
          </div>
        </div>

        <nav>
          <ul className="nav-links">
            {isAdmin && (
              <li>
                <button
                  className={`nav-link-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => onTabChange('dashboard')}
                >
                  <span>📊</span> Dashboard
                </button>
              </li>
            )}

            <li>
              <button
                className={`nav-link-btn ${activeTab === 'agenda' ? 'active' : ''}`}
                onClick={() => onTabChange('agenda')}
              >
                <span>📅</span> Agenda
              </button>
            </li>

            {isAdmin && (
              <>
                <li>
                  <button
                    className={`nav-link-btn ${activeTab === 'pacientes' ? 'active' : ''}`}
                    onClick={() => onTabChange('pacientes')}
                  >
                    <span>👤</span> Pacientes
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-link-btn ${activeTab === 'lista-espera' ? 'active' : ''}`}
                    onClick={() => onTabChange('lista-espera')}
                  >
                    <span>⏳</span> Lista de Espera
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-link-btn ${activeTab === 'usuarios' ? 'active' : ''}`}
                    onClick={() => onTabChange('usuarios')}
                  >
                    <span>👥</span> Usuários
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-link-btn ${activeTab === 'historico' ? 'active' : ''}`}
                    onClick={() => onTabChange('historico')}
                  >
                    <span>📜</span> Histórico
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="user-badge">
          <div className="user-avatar">{getInitials(usuario.nome)}</div>
          <div className="user-info">
            <div className="user-name" title={usuario.nome}>{usuario.nome}</div>
            <div className="user-role">
              {usuario.tipo === 'admin' ? 'Administrador' : 'Voluntário'}
            </div>
          </div>
        </div>
        <button
          className="nav-link-btn"
          onClick={onLogout}
          style={{ color: '#ef4444', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}
        >
          <span>🚪</span> Sair
        </button>
      </div>
    </aside>
  );
}
