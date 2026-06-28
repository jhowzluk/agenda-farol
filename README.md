# Agenda Farol

> Sistema web completo de agendamento de consultas e gestão de voluntários, desenvolvido para apoiar as ações sociais da Igreja Farol, apresentando controle de perfil (Admin/Voluntário), regras de negócio avançadas para limites de atendimento, fila de espera e relatórios históricos.

![Status](https://img.shields.io/badge/Status-concluído-green)
![Node.js](https://img.shields.io/badge/Node.js-v24-blue)
![React](https://img.shields.io/badge/React-v18-blue)
![Database](https://img.shields.io/badge/Database-TiDB_Cloud_(MySQL)-orange)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-black)

## Índice

- [Tecnologias](#tecnologias)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Modelagem do Banco de Dados](#modelagem-do-banco-de-dados)
- [Regras de Negócio](#regras-de-negócio)
- [Endpoints da API](#endpoints-da-api)
- [Como Executar](#como-executar)

---

## Tecnologias

| Tecnologia | Função no Projeto |
| :--- | :--- |
| **Node.js & Express** | Construção da API REST e servidor backend |
| **React (Vite)** | Interface de usuário (SPA) interativa e responsiva |
| **Vanilla CSS** | Design system personalizado, variáveis nativas e micro-animações |
| **TiDB Cloud (MySQL)** | Banco de dados relacional na nuvem com criptografia SSL |
| **JWT (JSON Web Tokens)** | Autenticação segura de sessões e controle de rotas privadas |
| **bcryptjs** | Criptografia de senhas com algoritmo de hash seguro |
| **Concurrently** | Execução paralela dos servidores de desenvolvimento local |

---

## Estrutura de Pastas

```
agenda-farol/
├── backend/
│   ├── database.js          # Configuração do Pool MySQL, SSL e DDL das tabelas
│   ├── seed.js              # Script automatizado para reiniciar/popular o banco
│   ├── server.js            # Rotas da API, autenticação e regras de negócio
│   └── vercel.json          # Configuração da Serverless Function na Vercel
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes modulares (Agenda, Pacientes, etc.)
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Agenda.jsx
│   │   │   ├── Pacientes.jsx
│   │   │   ├── ListaEspera.jsx
│   │   │   ├── Usuarios.jsx
│   │   │   └── Historico.jsx
│   │   ├── App.jsx          # Controle de sessão e roteamento interno por abas
│   │   ├── index.css        # Estilização global e tokens de design
│   │   └── main.jsx         # Ponto de entrada do React
│   ├── index.html           # Template HTML principal
│   └── vercel.json          # Configuração de proxies e rewrites na Vercel
├── vercel.json              # Configuração monorepo multi-serviços (raiz)
└── package.json             # Scripts e dependências gerais
```

---

## Modelagem do Banco de Dados

O banco de dados relacional é composto por 7 tabelas principais:

* **`usuarios`**: Cadastro de administradores (secretaria) e profissionais voluntários.
  * `id` (INT, PK), `nome`, `email` (Unique), `senha`, `tipo` ('admin', 'voluntario'), `especialidade`, `limite_diario`, `limite_mensal`.
* **`pacientes`**: Cadastro geral de pacientes.
  * `id` (INT, PK), `nome`, `telefone`, `idade`, `responsavel` (obrigatório para menores de 18), `observacoes`.
* **`disponibilidades`**: Horários recorrentes que os voluntários oferecem para atendimento.
  * `id` (INT, PK), `voluntario_id` (FK), `dia_semana` (0-6), `hora_inicio`, `hora_fim`, `recorrencia`.
* **`bloqueios_horario`**: Bloqueios temporários ou folgas na agenda de um voluntário.
  * `id` (INT, PK), `voluntario_id` (FK), `data`, `hora_inicio`, `hora_fim`, `motivo`.
* **`atendimentos`**: Registro de consultas agendadas, realizadas ou canceladas.
  * `id` (INT, PK), `paciente_id` (FK), `voluntario_id` (FK), `data`, `hora`, `status`, `observacoes`, `encaminhado_por` (FK), `cancelado_em`, `paciente_avisado`.
* **`lista_espera`**: Fila de espera ordenada cronologicamente para pacientes aguardando vaga.
  * `id` (INT, PK), `paciente_id` (FK, Unique), `observacoes`, `data_solicitacao`.
* **`encaminhamentos`**: Histórico de transferência de pacientes entre profissionais (ex: encaminhar do Psicólogo para o Psiquiatra).
  * `id` (INT, PK), `paciente_id` (FK), `voluntario_origem_id` (FK), `voluntario_destino_id` (FK), `data_encaminhamento`, `observacoes`.

---

## Regras de Negócio

O sistema automatiza diversas validações cruciais para o funcionamento da clínica social:

1. **Maioridade Penal (Proteção ao Menor):** Pacientes menores de 18 anos são impedidos de serem cadastrados ou receberem agendamentos sem que um nome de responsável legal esteja preenchido.
2. **Prevenção de Conflitos (Double Booking):** O sistema impede que um voluntário receba dois agendamentos no mesmo dia e horário.
3. **Bloqueios de Agenda:** Horários bloqueados manualmente por um voluntário ficam indisponíveis para novos agendamentos no painel da secretária.
4. **Limite de Atendimentos:** Respeita os limites individuais definidos no perfil do voluntário:
   * **Limite Diário:** Impede o agendamento se o profissional já atingiu o máximo de consultas que pode fazer no dia.
   * **Limite Mensal:** Bloqueia novos agendamentos caso a cota mensal de horas do voluntário tenha sido atingida.
5. **Prazo Limite de Agendamento:** Consultas só podem ser marcadas com no máximo 30 dias de antecedência para evitar reservas ociosas no longo prazo.
6. **Autoproteção de Administrador:** Um administrador logado é impedido de deletar a si mesmo ou de rebaixar o seu próprio nível de acesso para voluntário.

---

## Endpoints da API

### Autenticação
* `POST /api/auth/login` - Realiza login e gera token JWT.
* `GET /api/auth/me` - Valida sessão ativa e retorna dados do usuário logado.

### Usuários (Apenas Admin)
* `GET /api/usuarios` - Lista todos os usuários cadastrados.
* `POST /api/usuarios` - Cadastra um novo usuário.
* `PUT /api/usuarios/:id` - Atualiza dados do usuário (nome, e-mail, especialidade, limites).
* `DELETE /api/usuarios/:id` - Remove um usuário do sistema (bloqueado para si mesmo).

### Pacientes (Apenas Admin)
* `GET /api/pacientes` - Lista todos os pacientes cadastrados.
* `POST /api/pacientes` - Cadastra um novo paciente.
* `PUT /api/pacientes/:id` - Atualiza dados do paciente.
* `GET /api/pacientes/:id/historico` - Retorna o histórico completo de consultas e encaminhamentos do paciente.

### Agenda e Atendimentos
* `GET /api/atendimentos` - Filtra e lista consultas com base no voluntário ativo e filtros de data.
* `POST /api/atendimentos` - Agenda uma nova consulta.
* `PUT /api/atendimentos/:id` - Edita informações ou altera o status de uma consulta.
* `DELETE /api/atendimentos/:id` - Remove permanentemente uma consulta.

### Fila de Espera (Apenas Admin)
* `GET /api/lista-espera` - Lista os pacientes aguardando vaga.
* `POST /api/lista-espera` - Adiciona um paciente à fila.
* `DELETE /api/lista-espera/:id` - Remove o paciente da fila (usado ao convertê-lo em agendamento).

### Avisos e Dashboard (Apenas Admin)
* `GET /api/avisos` - Retorna alertas urgentes para a secretária:
  * Cancelamentos recentes que precisam de notificação ao paciente.
  * Consultas de hoje/amanhã pendentes de confirmação de presença.

---

## Como Executar

### Pré-requisitos
* Node.js instalado (versão 18 ou superior recomendada).
* Banco de dados MySQL rodando localmente ou conexão externa (ex: TiDB Cloud).

### Configuração do Ambiente

1. Clone o repositório:
   ```bash
   git clone https://github.com/jhowzluk/agenda-farol.git
   cd agenda-farol
   ```

2. Instale as dependências na pasta raiz, no backend e no frontend:
   ```bash
   npm install
   npm run install-all
   ```

3. Crie um arquivo `.env` dentro da pasta `backend/` seguindo o modelo abaixo:
   ```env
   PORT=5000
   JWT_SECRET=sua_chave_secreta_aqui
   DATABASE_URL=mysql://usuario:senha@host:porta/agenda_farol
   ```

4. Popule o banco de dados com a estrutura de tabelas e dados fictícios de teste:
   ```bash
   npm run seed --prefix backend
   ```

5. Inicie o ambiente de desenvolvimento (executa o frontend e o backend simultaneamente):
   ```bash
   npm run dev
   ```

O frontend estará disponível em `http://localhost:3000` e a API em `http://localhost:5000`.

### Credenciais de Teste Padrão (Geradas pelo Seed)
* **Secretária (Admin):** `analia@farol.org` | Senha: `farol123`
* **Psicóloga (Voluntária):** `marly@farol.org` | Senha: `marly123`
