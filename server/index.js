import { createServer as createHttpServer } from 'node:http';
import { createReadStream, mkdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = join(root, 'public');
const statuses = ['aberto', 'em_andamento', 'aguardando', 'resolvido'];
const ticketTypes = ['Hardware', 'Rede', 'Software', 'Impressora', 'Acesso'];
const statusLabels = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido'
};
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

class ApiError extends Error {}

export function createDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  return new DatabaseSync(databasePath);
}

export function initializeDatabase(db, { seed = true } = {}) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      requester TEXT NOT NULL,
      subject TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('aberto', 'em_andamento', 'aguardando', 'resolvido')),
      priority TEXT NOT NULL CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
      technician TEXT NOT NULL,
      technical_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_closed_at ON tickets(closed_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_status_type ON tickets(status, type);
  `);

  if (!seed || db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count > 0) {
    return;
  }

  const requesters = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Elisa Rocha', 'Felipe Costa'];
  const technicians = ['Marina Oliveira', 'Rafael Santos', 'Joana Ferreira', 'Pedro Martins'];
  const subjects = {
    Hardware: ['Computador não liga', 'Troca de memória', 'Estação reiniciando'],
    Rede: ['Sem acesso à rede', 'Wi-Fi instável', 'Conexão lenta'],
    Software: ['Erro ao abrir sistema', 'Atualização de aplicativo', 'Falha no login'],
    Impressora: ['Impressora sem conexão', 'Fila de impressão travada', 'Impressão com falhas'],
    Acesso: ['Solicitação de acesso', 'Permissão expirada', 'Redefinição de senha']
  };
  const insert = db.prepare(`
    INSERT INTO tickets
      (requester, subject, type, status, priority, technician, technical_notes, created_at, updated_at, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const today = new Date();
  const priorities = ['baixa', 'media', 'alta', 'critica'];
  const statusSequence = ['resolvido', 'resolvido', 'em_andamento', 'aberto', 'aguardando', 'resolvido'];

  db.exec('BEGIN');
  try {
    for (let index = 0; index < 60; index += 1) {
      const created = new Date(today);
      created.setUTCDate(today.getUTCDate() - ((index * 7) % 45));
      created.setUTCHours(8 + (index % 9), (index * 13) % 60, 0, 0);

      const type = ticketTypes[index % ticketTypes.length];
      const status = statusSequence[index % statusSequence.length];
      const closed = status === 'resolvido'
        ? new Date(created.getTime() + (2 + (index % 36)) * 60 * 60 * 1000)
        : null;
      const createdAt = created.toISOString();
      const updatedAt = (closed ?? new Date(created.getTime() + (index % 10) * 60 * 60 * 1000)).toISOString();
      const subjectList = subjects[type];

      insert.run(
        requesters[index % requesters.length],
        subjectList[index % subjectList.length],
        type,
        status,
        priorities[index % priorities.length],
        technicians[index % technicians.length],
        status === 'resolvido' ? 'Diagnóstico realizado e solução aplicada; operação validada com o solicitante.' : '',
        createdAt,
        updatedAt,
        closed?.toISOString() ?? null
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function parseDate(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
    throw new ApiError(`O parâmetro "${name}" deve usar o formato AAAA-MM-DD.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(`O parâmetro "${name}" não contém uma data válida.`);
  }
  return date;
}

function parseFilters(searchParams, db) {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFromDate = new Date(today);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 29);
  const defaultFrom = defaultFromDate.toISOString().slice(0, 10);
  const from = searchParams.get('from') ?? defaultFrom;
  const to = searchParams.get('to') ?? defaultTo;
  const fromDate = parseDate(from, 'from');
  const toDate = parseDate(to, 'to');

  if (fromDate > toDate) {
    throw new ApiError('A data inicial não pode ser posterior à data final.');
  }

  const status = searchParams.get('status') ?? '';
  if (status && !statuses.includes(status)) {
    throw new ApiError('Status inválido.');
  }

  const type = searchParams.get('type') ?? '';
  if (type && !db.prepare('SELECT 1 FROM tickets WHERE type = ? LIMIT 1').get(type)) {
    throw new ApiError('Tipo de chamado inválido.');
  }

  const endDate = new Date(toDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return {
    from: `${from}T00:00:00.000Z`,
    to,
    toExclusive: endDate.toISOString(),
    status,
    type
  };
}

function filtersSql(filters, column = 'created_at') {
  const clauses = [`${column} >= ?`, `${column} < ?`];
  const values = [filters.from, filters.toExclusive];
  if (filters.status) {
    clauses.push('status = ?');
    values.push(filters.status);
  }
  if (filters.type) {
    clauses.push('type = ?');
    values.push(filters.type);
  }
  return { where: clauses.join(' AND '), values };
}

function buildDashboard(db, filters) {
  const scope = filtersSql(filters);
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(status = 'aberto') AS open,
      SUM(status = 'em_andamento') AS inProgress,
      SUM(status = 'aguardando') AS waiting,
      SUM(status = 'resolvido') AS resolved
    FROM tickets
    WHERE ${scope.where}
  `).get(...scope.values);

  const resolvedScope = filtersSql(filters, 'closed_at');
  const dailyRows = db.prepare(`
    SELECT date(closed_at) AS day, COUNT(*) AS total
    FROM tickets
    WHERE closed_at IS NOT NULL AND ${resolvedScope.where}
    GROUP BY date(closed_at)
    ORDER BY day
  `).all(...resolvedScope.values);
  const resolution = db.prepare(`
    SELECT ROUND(AVG((julianday(closed_at) - julianday(created_at)) * 24), 1) AS averageHours
    FROM tickets
    WHERE closed_at IS NOT NULL AND ${resolvedScope.where}
  `).get(...resolvedScope.values);
  const types = db.prepare(`
    SELECT type, COUNT(*) AS total
    FROM tickets
    WHERE status = 'resolvido' AND closed_at IS NOT NULL AND ${resolvedScope.where}
    GROUP BY type
    ORDER BY total DESC, type ASC
  `).all(...resolvedScope.values);
  const statusRows = db.prepare(`
    SELECT status, COUNT(*) AS total
    FROM tickets
    WHERE ${scope.where}
    GROUP BY status
  `).all(...scope.values);
  const latest = db.prepare(`
    SELECT id, requester, subject, type, status, priority, technician, technical_notes, created_at, closed_at
    FROM tickets
    WHERE ${scope.where}
    ORDER BY created_at DESC
    LIMIT 8
  `).all(...scope.values);

  const days = new Map(dailyRows.map((row) => [row.day, row.total]));
  const dailyResolution = [];
  const start = new Date(filters.from);
  const end = new Date(filters.toExclusive);
  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    dailyResolution.push({ date: day, total: days.get(day) ?? 0 });
  }

  return {
    period: { from: filters.from.slice(0, 10), to: filters.to },
    summary: {
      total: summary.total ?? 0,
      open: summary.open ?? 0,
      inProgress: summary.inProgress ?? 0,
      waiting: summary.waiting ?? 0,
      resolved: summary.resolved ?? 0,
      averageResolutionHours: resolution.averageHours ?? 0
    },
    dailyResolution,
    statusBreakdown: statuses.map((status) => ({
      status,
      label: statusLabels[status],
      total: statusRows.find((row) => row.status === status)?.total ?? 0
    })),
    resolvedByType: types,
    ticketTypes,
    latestTickets: latest
  };
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function serveStatic(response, pathname) {
  const fileName = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html', 'styles.css', 'app.js'].includes(fileName)) {
    return false;
  }

  const filePath = join(publicDirectory, fileName);
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)],
    'Cache-Control': 'no-cache'
  });
  createReadStream(filePath).pipe(response);
  return true;
}

export function createServer(db) {
  return createHttpServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    try {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Método não permitido.' });
        return;
      }

      if (url.pathname === '/api/health') {
        sendJson(response, 200, { status: 'ok', database: 'sqlite' });
        return;
      }

      if (url.pathname === '/api/dashboard' || url.pathname === '/api/tickets') {
        const filters = parseFilters(url.searchParams, db);
        if (url.pathname === '/api/dashboard') {
          sendJson(response, 200, buildDashboard(db, filters));
          return;
        }

        const { where, values } = filtersSql(filters);
        const rows = db.prepare(`
          SELECT id, requester, subject, type, status, priority, technician, technical_notes, created_at, closed_at
          FROM tickets
          WHERE ${where}
          ORDER BY created_at DESC
          LIMIT 100
        `).all(...values);
        sendJson(response, 200, { total: rows.length, items: rows });
        return;
      }

      if (serveStatic(response, url.pathname)) {
        return;
      }
      sendJson(response, 404, { error: 'Recurso não encontrado.' });
    } catch (error) {
      if (error instanceof ApiError) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      console.error('Falha ao processar requisição:', error);
      sendJson(response, 500, { error: 'Erro interno ao processar a requisição.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const databasePath = process.env.DB_PATH ?? join(root, 'data', 'thindesk.sqlite');
  const db = createDatabase(databasePath);
  initializeDatabase(db);
  const server = createServer(db);
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => {
    console.log(`Thindesk Dashboard disponível em http://localhost:${port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(() => {
        db.close();
        process.exit(0);
      });
    });
  }
}
