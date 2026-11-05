const statusLabels = {
  recebido: 'Recebido',
  preparando: 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
};
const statusColors = {
  recebido: '#e5a944',
  preparando: '#8b71dc',
  pronto: '#58a0cd',
  entregue: '#42b584',
  cancelado: '#d97070'
};
const orderTypeLabels = { delivery: 'Entrega', retirada: 'Retirada', mesa: 'No local' };
const numberFormat = new Intl.NumberFormat('pt-BR');
const currencyFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const elements = Object.fromEntries([
  'fromDate', 'toDate', 'statusFilter', 'typeFilter', 'applyFilters', 'clearFilters',
  'refreshButton', 'errorBanner', 'metricTotal', 'metricPending', 'metricPreparing',
  'metricDelivered', 'orderRevenue', 'ordersChart', 'ordersEmpty', 'statusChart',
  'statusTotal', 'statusLegend', 'categoryRanking', 'orderRows'
].map((id) => [id, document.getElementById(id)]));

let dashboardData;

function dateInputValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function initializeDates() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  elements.fromDate.value = dateInputValue(from);
  elements.toDate.value = dateInputValue(today);
}

function queryString() {
  const params = new URLSearchParams({ from: elements.fromDate.value, to: elements.toDate.value });
  if (elements.statusFilter.value) params.set('status', elements.statusFilter.value);
  if (elements.typeFilter.value) params.set('type', elements.typeFilter.value);
  return params.toString();
}

async function loadDashboard() {
  elements.errorBanner.hidden = true;
  elements.applyFilters.disabled = true;
  try {
    const response = await fetch(`/api/orders/dashboard?${queryString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Não foi possível carregar os pedidos.');
    renderDashboard(data);
  } catch (error) {
    elements.errorBanner.textContent = `Falha ao atualizar os dados: ${error.message}`;
    elements.errorBanner.hidden = false;
  } finally {
    elements.applyFilters.disabled = false;
  }
}

function renderDashboard(data) {
  dashboardData = data;
  const { summary } = data;
  elements.metricTotal.textContent = numberFormat.format(summary.total);
  elements.metricPending.textContent = numberFormat.format(summary.pending);
  elements.metricPreparing.textContent = numberFormat.format(summary.preparing);
  elements.metricDelivered.textContent = numberFormat.format(summary.delivered);
  elements.orderRevenue.textContent = `Vendas: ${currencyFormat.format(summary.revenueCents / 100)}`;
  elements.statusTotal.textContent = numberFormat.format(summary.total);
  populateTypes(data.orderTypes);
  drawOrdersChart(data.dailyOrders);
  drawStatusChart(data.statusBreakdown);
  renderCategories(data.topCategories);
  renderOrders(data.latestOrders);
}

function populateTypes(types) {
  const selected = elements.typeFilter.value;
  elements.typeFilter.replaceChildren(new Option('Todas as modalidades', ''));
  for (const type of types) elements.typeFilter.add(new Option(type.label, type.value));
  elements.typeFilter.value = selected;
}

function prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  return context;
}

function drawOrdersChart(rows) {
  const canvas = elements.ordersChart;
  const context = prepareCanvas(canvas);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  elements.ordersEmpty.hidden = rows.some((row) => row.total > 0);
  if (!rows.length) return;

  const padding = { top: 16, right: 12, bottom: 31, left: 31 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(4, Math.ceil(Math.max(...rows.map((row) => row.total)) / 2) * 2);
  context.font = '9px Segoe UI, sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = padding.top + chartHeight * tick / 4;
    context.strokeStyle = '#edf0f5';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillStyle = '#a1a8b4';
    context.fillText(String(Math.round(max * (4 - tick) / 4)), padding.left - 8, y);
  }

  const step = rows.length > 1 ? chartWidth / (rows.length - 1) : chartWidth;
  const points = rows.map((row, index) => ({
    x: padding.left + (rows.length > 1 ? step * index : chartWidth / 2),
    y: padding.top + chartHeight * (1 - row.total / max),
    row
  }));
  if (points.length > 1) {
    const gradient = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(86, 105, 232, .19)');
    gradient.addColorStop(1, 'rgba(86, 105, 232, 0)');
    context.beginPath();
    context.moveTo(points[0].x, height - padding.bottom);
    for (const point of points) context.lineTo(point.x, point.y);
    context.lineTo(points.at(-1).x, height - padding.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = '#6274e8';
    context.lineWidth = 2;
    context.lineJoin = 'round';
    context.stroke();
  }

  const labelCount = Math.min(6, rows.length);
  const labelIndexes = new Set(Array.from({ length: labelCount }, (_, index) =>
    labelCount === 1 ? 0 : Math.round(index * (rows.length - 1) / (labelCount - 1))
  ));
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillStyle = '#9aa2af';
  for (const index of labelIndexes) {
    const point = points[index];
    const label = new Date(`${point.row.date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    context.fillText(label.replace('.', ''), point.x, height - padding.bottom + 10);
  }
}

function drawStatusChart(rows) {
  const canvas = elements.statusChart;
  const context = prepareCanvas(canvas);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const center = canvas.clientWidth / 2;
  const radius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.43;
  context.lineWidth = 17;
  let angle = -Math.PI / 2;
  for (const row of rows) {
    const span = total ? (row.total / total) * Math.PI * 2 : Math.PI * 2;
    context.beginPath();
    context.arc(center, center, radius, angle, angle + span);
    context.strokeStyle = row.total ? statusColors[row.status] : '#edf0f5';
    context.stroke();
    angle += span;
  }

  elements.statusLegend.replaceChildren(...rows.map((row) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.backgroundColor = statusColors[row.status];
    const label = document.createElement('span');
    label.textContent = row.label;
    const value = document.createElement('span');
    value.className = 'legend-value';
    value.textContent = numberFormat.format(row.total);
    item.append(dot, label, value);
    return item;
  }));
}

function renderCategories(categories) {
  const max = Math.max(1, ...categories.map((category) => category.quantity));
  if (!categories.length) {
    elements.categoryRanking.innerHTML = '<div class="empty-state">Nenhum item vendido no período.</div>';
    return;
  }
  elements.categoryRanking.replaceChildren(...categories.slice(0, 5).map((category) => {
    const item = document.createElement('div');
    item.className = 'ranking-item';
    const label = document.createElement('span');
    label.textContent = category.category;
    const track = document.createElement('span');
    track.className = 'ranking-track';
    const fill = document.createElement('span');
    fill.className = 'ranking-fill';
    fill.style.display = 'block';
    fill.style.width = `${category.quantity / max * 100}%`;
    track.append(fill);
    const count = document.createElement('span');
    count.className = 'ranking-count';
    count.textContent = numberFormat.format(category.quantity);
    item.append(label, track, count);
    return item;
  }));
}

function renderOrders(orders) {
  if (!orders.length) {
    elements.orderRows.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum pedido encontrado para os filtros aplicados.</td></tr>';
    return;
  }
  elements.orderRows.replaceChildren(...orders.map((order) => {
    const row = document.createElement('tr');
    const orderCell = document.createElement('td');
    const id = document.createElement('span');
    id.className = 'ticket-subject';
    id.textContent = `#PD-${String(order.id).padStart(4, '0')}`;
    const customer = document.createElement('span');
    customer.className = 'ticket-id';
    customer.textContent = order.customer;
    orderCell.append(id, customer);

    const products = document.createElement('td');
    products.className = 'order-products';
    products.textContent = order.products || 'Sem itens';
    products.title = order.products || '';
    const status = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${order.status}`;
    badge.textContent = statusLabels[order.status];
    status.append(badge);
    const type = document.createElement('td');
    type.textContent = orderTypeLabels[order.order_type];
    const total = document.createElement('td');
    total.textContent = currencyFormat.format(order.totalCents / 100);
    row.append(orderCell, products, status, type, total);
    return row;
  }));
}

elements.applyFilters.addEventListener('click', loadDashboard);
elements.refreshButton.addEventListener('click', loadDashboard);
elements.clearFilters.addEventListener('click', () => {
  initializeDates();
  elements.statusFilter.value = '';
  elements.typeFilter.value = '';
  loadDashboard();
});
window.addEventListener('resize', () => {
  if (dashboardData) {
    drawOrdersChart(dashboardData.dailyOrders);
    drawStatusChart(dashboardData.statusBreakdown);
  }
});

initializeDates();
loadDashboard();
window.setInterval(loadDashboard, 60_000);
