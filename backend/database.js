import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const isLocal = !process.env.DATABASE_URL || 
                process.env.DATABASE_URL.includes('localhost') || 
                process.env.DATABASE_URL.includes('127.0.0.1');

// TiDB Cloud / Production databases require SSL
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL || 'mysql://root@localhost:3306/agenda_farol',
  ssl: isLocal ? null : { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Run DB queries as Promises (SQLite compatibility layer)
const dbRun = async (sql, params = []) => {
  if (params.length === 0) {
    const [result] = await pool.query(sql);
    return { id: result.insertId, changes: result.affectedRows };
  }
  const [result] = await pool.execute(sql, params);
  return { id: result.insertId, changes: result.affectedRows };
};

const dbAll = async (sql, params = []) => {
  if (params.length === 0) {
    const [rows] = await pool.query(sql);
    return rows;
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
};

const dbGet = async (sql, params = []) => {
  if (params.length === 0) {
    const [rows] = await pool.query(sql);
    return rows[0] || null;
  }
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
};

// Initialize schema tables (adapted for MySQL / TiDB)
const initializeDatabase = async () => {
  try {
    // 1. Usuarios Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        tipo VARCHAR(50) NOT NULL CHECK(tipo IN ('admin', 'voluntario')),
        limite_diario INT DEFAULT NULL,
        limite_mensal INT DEFAULT NULL
      )
    `);

    // 2. Pacientes Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS pacientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        telefone VARCHAR(50) NOT NULL,
        idade INT DEFAULT NULL,
        responsavel VARCHAR(255) DEFAULT NULL,
        observacoes TEXT
      )
    `);

    // 3. Disponibilidades Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS disponibilidades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voluntario_id INT NOT NULL,
        dia_semana INT NOT NULL CHECK(dia_semana BETWEEN 0 AND 6),
        hora_inicio VARCHAR(10) NOT NULL, -- HH:MM
        hora_fim VARCHAR(10) NOT NULL, -- HH:MM
        recorrencia VARCHAR(50) NOT NULL CHECK(recorrencia IN ('semanal', 'quinzenal_impar', 'quinzenal_par', 'mensal')),
        FOREIGN KEY(voluntario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    // 4. Bloqueios Horario Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS bloqueios_horario (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voluntario_id INT NOT NULL,
        data VARCHAR(10) NOT NULL, -- YYYY-MM-DD
        hora_inicio VARCHAR(10) NOT NULL, -- HH:MM
        hora_fim VARCHAR(10) NOT NULL, -- HH:MM
        motivo TEXT,
        FOREIGN KEY(voluntario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    // 5. Atendimentos Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS atendimentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        paciente_id INT NOT NULL,
        voluntario_id INT NOT NULL,
        data VARCHAR(10) NOT NULL, -- YYYY-MM-DD
        hora VARCHAR(10) NOT NULL, -- HH:MM
        status VARCHAR(50) DEFAULT 'agendado' CHECK(status IN ('agendado', 'confirmado', 'cancelado', 'falta', 'compareceu')),
        observacoes TEXT,
        encaminhado_por INT DEFAULT NULL,
        cancelado_em VARCHAR(50) DEFAULT NULL,
        paciente_avisado TINYINT DEFAULT 0, -- 0 = False, 1 = True
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
        FOREIGN KEY(voluntario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY(encaminhado_por) REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `);

    // 6. ListaEspera Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS lista_espera (
        id INT AUTO_INCREMENT PRIMARY KEY,
        paciente_id INT UNIQUE NOT NULL,
        observacoes TEXT,
        data_solicitacao VARCHAR(20) NOT NULL, -- YYYY-MM-DD HH:MM:SS
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
      )
    `);

    // 7. Encaminhamentos Table (Audit / History Log)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS encaminhamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        paciente_id INT NOT NULL,
        voluntario_origem_id INT NOT NULL,
        voluntario_destino_id INT NOT NULL,
        data_encaminhamento VARCHAR(20) NOT NULL, -- YYYY-MM-DD HH:MM:SS
        observacoes TEXT,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
        FOREIGN KEY(voluntario_origem_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY(voluntario_destino_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    console.log('Database tables verified/created successfully.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
  }
};

export {
  pool as db,
  dbRun,
  dbAll,
  dbGet,
  initializeDatabase
};
