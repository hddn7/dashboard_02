import { createServer as createHttpServer } from 'node:http';
import { createReadStream, mkdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = join(root, 'public');
const statuses = ['aberto', 'em_andamento', 'aguardando', 'resolvido'];
const ticketTypes = ['Hardware', 'Rede', 'Software', 'Impressora', 'Acesso'];
const orderStatuses = ['recebido', 'preparando', 'pronto', 'entregue', 'cancelado'];
const orderTypes = ['delivery', 'retirada', 'mesa'];
const orderCategories = ['Pizzas', 'Hambúrgueres', 'Bebidas', 'Porções', 'Sobremesas'];
const statusLabels = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido',
  recebido: 'Recebido',
  preparando: 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
};
const orderTypeLabels = {
  delivery: 'Entrega',
  retirada: 'Retirada',
  mesa: 'Consumo no local'
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
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      customer TEXT NOT NULL,
      order_type TEXT NOT NULL CHECK (order_type IN ('delivery', 'retirada', 'mesa')),
      status TEXT NOT NULL CHECK (status IN ('recebido', 'preparando', 'pronto', 'entregue', 'cancelado')),
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      delivered_at TEXT
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status_type ON orders(status, order_type);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_category ON order_items(order_id, category);
  `);

  if (!seed) {
    return;
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count === 0) {
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

  if (db.prepare('SELECT COUNT(*) AS count FROM orders').get().count > 0) {
    return;
  }

  seedOrders(db);
}

function seedOrders(db) {
  const customers = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Elisa Rocha', 'Felipe Costa', 'Gabriel Nunes', 'Helena Prado'];
  const products = [
    { name: 'Pizza Margherita', category: 'Pizzas', price: 4290 },
    { name: 'Pizza Calabresa', category: 'Pizzas', price: 4590 },
    { name: 'Pizza Quatro Queijos', category: 'Pizzas', price: 4990 },
    { name: 'Hambúrguer Clássico', category: 'Hambúrgueres', price: 2890 },
    { name: 'Hambúrguer da Casa', category: 'Hambúrgueres', price: 3590 },
    { name: 'Refrigerante', category: 'Bebidas', price: 800 },
    { name: 'Suco Natural', category: 'Bebidas', price: 1200 },
    { name: 'Batata Frita', category: 'Porções', price: 1890 },
    { name: 'Brownie', category: 'Sobremesas', price: 1400 }
  ];
  const statusesByOrder = ['entregue', 'entregue', 'entregue', 'preparando', 'recebido', 'pronto', 'entregue', 'cancelado'];
  const types = ['delivery', 'retirada', 'mesa'];
  const insertOrder = db.prepare(`
    INSERT INTO orders (customer, order_type, status, total_cents, notes, created_at, updated_at, delivered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_name, category, quantity, unit_price_cents)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (let index = 0; index < 90; index += 1) {
      const created = new Date();
      created.setUTCDate(created.getUTCDate() - ((index * 5) % 45));
      created.setUTCHours(10 + (index % 11), (index * 17) % 60, 0, 0);
      const status = statusesByOrder[index % statusesByOrder.length];
      const delivered = status === 'entregue'
        ? new Date(created.getTime() + (20 + (index % 55)) * 60_000)
        : null;
      const updated = delivered ?? new Date(created.getTime() + (index % 25) * 60_000);
      const orderItems = [products[index % products.length]];
      if (index % 3 !== 0) orderItems.push(products[(index + 5) % products.length]);
      if (index % 7 === 0) orderItems.push(products[(index + 2) % products.length]);
      const total = orderItems.reduce((sum, product, itemIndex) =>
        sum + product.price * (itemIndex === 0 && index % 4 === 0 ? 2 : 1), 0);
      const result = insertOrder.run(
        customers[index % customers.length],
        types[index % types.length],
        status,
        status === 'cancelado' ? 0 : total,
        index % 5 === 0 ? 'Conferir observações especiais do pedido.' : '',
        created.toISOString(),
        updated.toISOString(),
        delivered?.toISOString() ?? null
      );

      for (const [itemIndex, product] of orderItems.entries()) {
        insertItem.run(
          Number(result.lastInsertRowid),
          product.name,
          product.category,
          itemIndex === 0 && index % 4 === 0 ? 2 : 1,
          product.price
        );
      }
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

function parseOrderFilters(searchParams, db) {
  const dateParams = new URLSearchParams();
  for (const key of ['from', 'to']) {
    const value = searchParams.get(key);
    if (value !== null) dateParams.set(key, value);
  }
  const filters = parseFilters(dateParams, db);
  const status = searchParams.get('status') ?? '';
  if (status && !orderStatuses.includes(status)) {
    throw new ApiError('Status de pedido inválido.');
  }

  const type = searchParams.get('type') ?? '';
  if (type && !orderTypes.includes(type)) {
    throw new ApiError('Tipo de pedido inválido.');
  }

  return { ...filters, status, type };
}

function orderFiltersSql(filters, column = 'created_at') {
  const clauses = [`${column} >= ?`, `${column} < ?`];
  const values = [filters.from, filters.toExclusive];
  if (filters.status) {
    clauses.push('status = ?');
    values.push(filters.status);
  }
  if (filters.type) {
    clauses.push('order_type = ?');
    values.push(filters.type);
  }
  return { where: clauses.join(' AND '), values };
}

function buildOrdersDashboard(db, filters) {
  const scope = orderFiltersSql(filters);
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(status IN ('recebido', 'preparando', 'pronto')) AS pending,
      SUM(status = 'preparando') AS preparing,
      SUM(status = 'pronto') AS ready,
      SUM(status = 'entregue') AS delivered,
      SUM(CASE WHEN status = 'entregue' THEN total_cents ELSE 0 END) AS revenueCents
    FROM orders
    WHERE ${scope.where}
  `).get(...scope.values);

  const deliveredScope = orderFiltersSql(filters, 'delivered_at');
  const dailyRows = db.prepare(`
    SELECT date(delivered_at) AS day, COUNT(*) AS total
    FROM orders
    WHERE delivered_at IS NOT NULL AND ${deliveredScope.where}
    GROUP BY date(delivered_at)
    ORDER BY day
  `).all(...deliveredScope.values);
  const fulfillment = db.prepare(`
    SELECT ROUND(AVG((julianday(delivered_at) - julianday(created_at)) * 1440), 1) AS averageMinutes
    FROM orders
    WHERE status = 'entregue' AND delivered_at IS NOT NULL AND ${deliveredScope.where}
  `).get(...deliveredScope.values);
  const categories = db.prepare(`
    SELECT item.category, SUM(item.quantity) AS quantity, COUNT(DISTINCT order_row.id) AS orders
    FROM orders AS order_row
    JOIN order_items AS item ON item.order_id = order_row.id
    WHERE order_row.status = 'entregue' AND order_row.delivered_at IS NOT NULL
      AND ${deliveredScope.where.replaceAll('delivered_at', 'order_row.delivered_at').replaceAll('status = ?', 'order_row.status = ?').replaceAll('order_type = ?', 'order_row.order_type = ?')}
    GROUP BY item.category
    ORDER BY quantity DESC, item.category ASC
  `).all(...deliveredScope.values);
  const statusRows = db.prepare(`
    SELECT status, COUNT(*) AS total
    FROM orders
    WHERE ${scope.where}
    GROUP BY status
  `).all(...scope.values);
  const latest = db.prepare(`
    SELECT
      order_row.id, order_row.customer, order_row.order_type, order_row.status,
      order_row.total_cents AS totalCents, order_row.notes, order_row.created_at,
      (SELECT group_concat(item.product_name || ' ×' || item.quantity, ', ')
       FROM order_items AS item WHERE item.order_id = order_row.id) AS products
    FROM orders AS order_row
    WHERE ${scope.where.replaceAll('created_at', 'order_row.created_at').replaceAll('status = ?', 'order_row.status = ?').replaceAll('order_type = ?', 'order_row.order_type = ?')}
    ORDER BY order_row.created_at DESC
    LIMIT 8
  `).all(...scope.values);

  const days = new Map(dailyRows.map((row) => [row.day, row.total]));
  const dailyOrders = [];
  const start = new Date(filters.from);
  const end = new Date(filters.toExclusive);
  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    dailyOrders.push({ date: day, total: days.get(day) ?? 0 });
  }

  return {
    period: { from: filters.from.slice(0, 10), to: filters.to },
    summary: {
      total: summary.total ?? 0,
      pending: summary.pending ?? 0,
      preparing: summary.preparing ?? 0,
      ready: summary.ready ?? 0,
      delivered: summary.delivered ?? 0,
      revenueCents: summary.revenueCents ?? 0,
      averageFulfillmentMinutes: fulfillment.averageMinutes ?? 0
    },
    dailyOrders,
    statusBreakdown: orderStatuses.map((status) => ({
      status,
      label: statusLabels[status],
      total: statusRows.find((row) => row.status === status)?.total ?? 0
    })),
    topCategories: categories,
    orderTypes: orderTypes.map((type) => ({ value: type, label: orderTypeLabels[type] })),
    latestOrders: latest
  };
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function serveStatic(response, pathname) {
  const fileName = pathname === '/' ? 'index.html' : pathname === '/orders' ? 'orders.html' : pathname.slice(1);
  const knownFiles = ['index.html', 'orders.html', 'styles.css', 'app.js', 'orders-app.js'];
  if (!knownFiles.includes(fileName)) {
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

      if (url.pathname === '/api/orders/dashboard' || url.pathname === '/api/orders') {
        const filters = parseOrderFilters(url.searchParams, db);
        if (url.pathname === '/api/orders/dashboard') {
          sendJson(response, 200, buildOrdersDashboard(db, filters));
          return;
        }

        const { where, values } = orderFiltersSql(filters, 'order_row.created_at');
        const rows = db.prepare(`
          SELECT
            order_row.id, order_row.customer, order_row.order_type, order_row.status,
            order_row.total_cents AS totalCents, order_row.notes, order_row.created_at,
            (SELECT group_concat(item.product_name || ' ×' || item.quantity, ', ')
             FROM order_items AS item WHERE item.order_id = order_row.id) AS products
          FROM orders AS order_row
          WHERE ${where}
          ORDER BY order_row.created_at DESC
          LIMIT 100
        `).all(...values);
        sendJson(response, 200, { total: rows.length, items: rows });
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
