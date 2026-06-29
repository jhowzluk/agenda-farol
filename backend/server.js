import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routers
import authRouter from './routes/auth.js';
import usuariosRouter from './routes/usuarios.js';
import pacientesRouter from './routes/pacientes.js';
import atendimentosRouter from './routes/atendimentos.js';
import listaEsperaRouter from './routes/listaEspera.js';
import encaminhamentosRouter from './routes/encaminhamentos.js';
import historicoRouter from './routes/historico.js';
import avisosRouter from './routes/avisos.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/pacientes', pacientesRouter);
app.use('/api/atendimentos', atendimentosRouter);
app.use('/api/lista-espera', listaEsperaRouter);
app.use('/api/encaminhamentos', encaminhamentosRouter);
app.use('/api/historico', historicoRouter);
app.use('/api/avisos', avisosRouter);

// Start listening
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;
