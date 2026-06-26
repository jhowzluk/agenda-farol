import bcryptjs from 'bcryptjs';
import { db, initializeDatabase, dbRun, dbGet, dbAll } from './database.js';

const seed = async () => {
  console.log('Starting database seeding...');
  await initializeDatabase();

  try {
    // Clear existing data and reset autoincrement sequences (MySQL style)
    await dbRun('SET FOREIGN_KEY_CHECKS = 0');
    await dbRun('TRUNCATE TABLE usuarios');
    await dbRun('TRUNCATE TABLE pacientes');
    await dbRun('TRUNCATE TABLE disponibilidades');
    await dbRun('TRUNCATE TABLE bloqueios_horario');
    await dbRun('TRUNCATE TABLE atendimentos');
    await dbRun('TRUNCATE TABLE lista_espera');
    await dbRun('TRUNCATE TABLE encaminhamentos');
    await dbRun('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Cleared and reset existing tables.');

    // 1. Create Users
    const salt = await bcryptjs.genSalt(10);
    const hashAnalia = await bcryptjs.hash('farol123', salt);
    const hashMarly = await bcryptjs.hash('marly123', salt);
    const hashLaercio = await bcryptjs.hash('laercio123', salt);
    const hashThais = await bcryptjs.hash('thais123', salt);

    // Insert Admin
    const adminResult = await dbRun(
      'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
      ['Anália (Secretária)', 'analia@farol.org', hashAnalia, 'admin']
    );
    const analiaId = adminResult.id;

    // Insert Volunteers
    const marlyResult = await dbRun(
      'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
      ['Marly Inácio (Psicóloga)', 'marly@farol.org', hashMarly, 'voluntario']
    );
    const marlyId = marlyResult.id;

    const laercioResult = await dbRun(
      'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
      ['Laércio Fillus Pires (Terapeuta)', 'laercio@farol.org', hashLaercio, 'voluntario']
    );
    const laercioId = laercioResult.id;

    const thaisResult = await dbRun(
      'INSERT INTO usuarios (nome, email, senha, tipo, limite_mensal) VALUES (?, ?, ?, ?, ?)',
      ['Thaís (Psiquiatra)', 'thais@farol.org', hashThais, 'voluntario', 2] // limit of 2 per month
    );
    const thaisId = thaisResult.id;

    console.log('Seeded users: Anália (Admin), Marly (Voluntária), Laércio (Voluntário), Thaís (Voluntária).');

    // 2. Create Patients
    // Format: Name, Phone, Age, Responsible, Observations
    const patients = [
      ['Júlia Santos', '47991112233', 25, null, 'Estudante universitária, queixa de ansiedade.'],
      ['Sheila Rodrigues', '47992223344', 34, null, 'Dificuldades no trabalho, sintomas depressivos.'],
      ['Simone Lima', '47993334455', 42, null, 'Problemas de relacionamento familiar.'],
      ['Edilene Souza', '47994445566', 38, null, 'Acompanhamento pós-luto.'],
      ['Tati Mendes', '47995556677', 29, null, 'Transtorno de pânico leve.'],
      ['Laura Silva', '47996667788', 6, 'Sônia (Mãe)', 'Criança hiperativa. Vínculo escolar.'],
      ['Renato Oliveira', '47997778899', 19, null, 'Problemas de auto-estima.'],
      ['Eduardo Costa', '47998889900', 45, null, 'Gerenciamento de estresse.'],
      ['Sara Ramos', '47999990011', 31, null, 'Crises de choro frequentes.'],
      ['Sophia Abreu', '47991234567', 6, 'Patrícia (Mãe)', 'Desenvolvimento infantil tardio.'],
      ['Francine Becker', '47992345678', 15, 'Mário Becker (Pai)', 'Adolescente com fobia social.'],
      ['Josi Medeiros', '47993456789', 53, null, 'Depressão moderada.'],
      ['Wagner Bruno', '47994567890', 27, null, 'Dificuldade de concentração.'],
      ['Rosi Sampaio', '47995678901', 35, null, 'Ansiedade generalizada.'],
      ['Lolô Vieira', '47996789012', 12, 'Helena Vieira (Mãe)', 'Problemas comportamentais.'],
      ['Heloísa Neves', '47997890123', 21, null, 'Luto recente.'],
      ['Bryan Nogueira', '47998901234', 7, 'Clarice Nogueira (Mãe)', 'Necessita avaliação de TDAH.'],
      ['Pedro Henrique', '47999012345', 17, 'Augusto (Pai)', 'Dificuldade acadêmica.'],
      ['Isabelle Flores', '47990123456', 22, null, 'Ansiedade social.'],
      ['Paulo Henrique', '47991230495', 47, null, 'Dificuldade para dormir.'],
      ['Maria Eduarda', '47992340567', 10, 'Aline (Mãe)', 'Acompanhamento escolar.'],
      ['Samuel Reis', '47993450678', 56, null, 'Aposentado, queixa de solidão e desânimo.']
    ];

    const seededPatients = [];
    for (const p of patients) {
      const res = await dbRun(
        'INSERT INTO pacientes (nome, telefone, idade, responsavel, observacoes) VALUES (?, ?, ?, ?, ?)',
        p
      );
      seededPatients.push({ id: res.id, nome: p[0] });
    }
    console.log(`Seeded ${seededPatients.length} patients.`);

    // Helper map of patient names to IDs
    const patientMap = seededPatients.reduce((map, p) => {
      map[p.nome] = p.id;
      return map;
    }, {});

    // 3. Create Availabilities (Disponibilidade)
    // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
    const availabilities = [
      // Marly Inácio (Psicóloga) - Mondays, Tuesdays, Wednesdays, Thursdays
      [marlyId, 1, '14:00', '19:00', 'semanal'], // Monday
      [marlyId, 2, '16:00', '19:00', 'semanal'], // Tuesday
      [marlyId, 3, '08:00', '12:00', 'semanal'], // Wednesday Morning
      [marlyId, 3, '14:00', '19:00', 'semanal'], // Wednesday Afternoon
      [marlyId, 4, '14:00', '19:00', 'semanal'], // Thursday

      // Laércio (Terapeuta) - Tuesdays & Wednesdays
      [laercioId, 2, '08:00', '11:00', 'semanal'],
      [laercioId, 2, '14:00', '18:00', 'semanal'],
      [laercioId, 3, '14:00', '18:00', 'semanal'],

      // Thaís (Psiquiatra) - Fridays (monthly/mensal recurrence)
      [thaisId, 5, '09:00', '11:00', 'mensal']
    ];

    for (const av of availabilities) {
      await dbRun(
        'INSERT INTO disponibilidades (voluntario_id, dia_semana, hora_inicio, hora_fim, recorrencia) VALUES (?, ?, ?, ?, ?)',
        av
      );
    }
    console.log('Seeded availabilities.');

    // 4. Create manual blocks (BloqueioHorario)
    // e.g., Marly is in training on next Monday
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
    const nextMondayStr = nextMonday.toISOString().split('T')[0];

    await dbRun(
      'INSERT INTO bloqueios_horario (voluntario_id, data, hora_inicio, hora_fim, motivo) VALUES (?, ?, ?, ?, ?)',
      [marlyId, nextMondayStr, '14:00', '16:00', 'Treinamento de Equipe']
    );
    console.log(`Seeded manual block for Marly on ${nextMondayStr} 14:00-16:00.`);

    // 5. Create some sample appointments (Atendimento)
    // We will seed some past and future appointments.
    // Let's get actual dates.
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const appointments = [
      // Past appointments
      [patientMap['Júlia Santos'], marlyId, yesterdayStr, '14:00', 'compareceu', 'Teve progresso no controle da ansiedade', null],
      [patientMap['Sheila Rodrigues'], marlyId, yesterdayStr, '16:00', 'falta', 'Faltou sem avisar', null],

      // Today's appointments (need confirmation or highlight)
      [patientMap['Tati Mendes'], marlyId, todayStr, '18:00', 'agendado', 'Sessão semanal', null],
      [patientMap['Renato Oliveira'], marlyId, todayStr, '17:30', 'confirmado', 'Confirmado pelo WhatsApp', null],

      // Tomorrow's appointments (requires confirmation reminder)
      [patientMap['Sara Ramos'], marlyId, tomorrowStr, '08:00', 'agendado', 'Primeira sessão do mês', null],
      [patientMap['Sophia Abreu'], marlyId, tomorrowStr, '09:00', 'agendado', 'Acompanhada pela mãe', null],

      // Cancelled appointment to demonstrate WhatsApp alert
      [patientMap['Eduardo Costa'], marlyId, todayStr, '15:00', 'cancelado', 'Paciente gripado', null],

      // An appointment with psiquiatra Thaís
      [patientMap['Júlia Santos'], thaisId, tomorrowStr, '09:00', 'agendado', 'Encaminhada pela psicóloga Marly', marlyId]
    ];

    for (const app of appointments) {
      await dbRun(
        'INSERT INTO atendimentos (paciente_id, voluntario_id, data, hora, status, observacoes, encaminhado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
        app
      );
    }
    console.log('Seeded sample appointments.');

    // 6. Create Waitlist entries
    const waitlist = [
      [patientMap['Wagner Bruno'], 'Deseja horário no final da tarde', todayStr + ' 10:00:00'],
      [patientMap['Lolô Vieira'], 'Disponível apenas às quartas', todayStr + ' 11:30:00'],
      [patientMap['Bryan Nogueira'], 'Preferência por sábado ou sexta à tarde', todayStr + ' 14:15:00']
    ];

    for (const wl of waitlist) {
      await dbRun(
        'INSERT INTO lista_espera (paciente_id, observacoes, data_solicitacao) VALUES (?, ?, ?)',
        wl
      );
    }
    console.log('Seeded waiting list.');

    // 7. Seed forwarding history (Encaminhamentos)
    // To show how a patient was referred
    await dbRun(
      'INSERT INTO encaminhamentos (paciente_id, voluntario_origem_id, voluntario_destino_id, data_encaminhamento, observacoes) VALUES (?, ?, ?, ?, ?)',
      [patientMap['Júlia Santos'], marlyId, thaisId, yesterdayStr + ' 15:30:00', 'Paciente necessita de avaliação medicamentosa para suporte a crises de pânico.']
    );
    console.log('Seeded referral logs.');

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error during database seeding:', error);
  } finally {
    await db.end();
  }
};

seed();
