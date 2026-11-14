const statusLabels = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido'
};
const statusColors = {
  aberto: '#e5a944',
  em_andamento: '#8b71dc',
  aguardando: '#58a0cd',
  resolvido: '#42b584'
};
const numberFormat = new Intl.NumberFormat('pt-BR');
const elements = Object.fromEntries([
  'fromDate', 'toDate', 'statusFilter', 'typeFilter', 'applyFilters', 'clearFilters',
  'refreshButton', 'lastUpdated', 'errorBanner', 'metricTotal', 'metricOpen', 'metricProgress',
  'metricResolved', 'averageResolution', 'resolutionChart', 'resolutionEmpty',
  'statusChart', 'statusTotal', 'statusLegend', 'typeRanking', 'ticketRows'
].map((id) => [id, document.getElementById(id)]));

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
  const params = new URLSearchParams({
    from: elements.fromDate.value,
    to: elements.toDate.value
  });
  if (elements.statusFilter.value) params.set('status', elements.statusFilter.value);
  if (elements.typeFilter.value) params.set('type', elements.typeFilter.value);
  return params.toString();
}

async function loadDashboard() {
  elements.errorBanner.hidden = true;
  elements.applyFilters.disabled = true;
  try {
    const response = await fetch(`/api/dashboard?${queryString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Não foi possível carregar o dashboard.');
    renderDashboard(data);
    elements.lastUpdated.textContent = `Atualizado às ${new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date())}`;
  } catch (error) {
    elements.errorBanner.textContent = `Falha ao atualizar os dados: ${error.message}`;
    elements.errorBanner.hidden = false;
  } finally {
    elements.applyFilters.disabled = false;
  }
}

function updateDashboardView(data) {
  window.dashboardData = data;
  const { summary } = data;
  elements.metricTotal.textContent = numberFormat.format(summary.total);
  elements.metricOpen.textContent = numberFormat.format(summary.open + summary.waiting);
  elements.metricProgress.textContent = numberFormat.format(summary.inProgress);
  elements.metricResolved.textContent = numberFormat.format(summary.resolved);
  elements.averageResolution.textContent = `Média de resolução: ${summary.averageResolutionHours.toLocaleString('pt-BR')} h`;
  elements.statusTotal.textContent = numberFormat.format(summary.total);
  populateTypes(data.ticketTypes);
  drawResolutionChart(data.dailyResolution);
  drawStatusChart(data.statusBreakdown);
  renderRanking(data.resolvedByType);
  renderTickets(data.latestTickets);
}

function populateTypes(types) {
  const selected = elements.typeFilter.value;
  elements.typeFilter.replaceChildren(new Option('Todos os tipos', ''));
  for (const type of types) elements.typeFilter.add(new Option(type, type));
  elements.typeFilter.value = selected;
}

function drawResolutionChart(rows) {
  const canvas = elements.resolutionChart;
  const context = prepareCanvas(canvas);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  elements.resolutionEmpty.hidden = rows.some((row) => row.total > 0);
  if (!rows.length) return;

  const padding = { top: 16, right: 12, bottom: 31, left: 31 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(4, Math.ceil(Math.max(...rows.map((row) => row.total)) / 2) * 2);
  context.font = '9px DM Sans, sans-serif';
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

function drawStatusChart(rows) {
  const canvas = elements.statusChart;
  const context = prepareCanvas(canvas);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const center = canvas.clientWidth / 2;
  const radius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.43;
  const width = 17;
  let angle = -Math.PI / 2;
  context.lineWidth = width;
  context.lineCap = 'butt';
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

function renderRanking(rows) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  if (!rows.length) {
    elements.typeRanking.innerHTML = '<div class="empty-state">Nenhum chamado resolvido no período.</div>';
    return;
  }
  elements.typeRanking.replaceChildren(...rows.slice(0, 5).map((row) => {
    const item = document.createElement('div');
    item.className = 'ranking-item';
    const label = document.createElement('span');
    label.textContent = row.type;
    const track = document.createElement('span');
    track.className = 'ranking-track';
    const fill = document.createElement('span');
    fill.className = 'ranking-fill';
    fill.style.display = 'block';
    fill.style.width = `${row.total / max * 100}%`;
    track.append(fill);
    const count = document.createElement('span');
    count.className = 'ranking-count';
    count.textContent = numberFormat.format(row.total);
    item.append(label, track, count);
    return item;
  }));
}

function renderTickets(tickets) {
  if (!tickets.length) {
    elements.ticketRows.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum chamado encontrado para os filtros aplicados.</td></tr>';
    return;
  }
  elements.ticketRows.replaceChildren(...tickets.map((ticket) => {
    const row = document.createElement('tr');
    const subjectCell = document.createElement('td');
    const subject = document.createElement('span');
    subject.className = 'ticket-subject';
    subject.textContent = ticket.subject;
    const id = document.createElement('span');
    id.className = 'ticket-id';
    id.textContent = `#TD-${String(ticket.id).padStart(4, '0')} · ${ticket.requester}`;
    subjectCell.append(subject, id);

    const type = document.createElement('td');
    type.textContent = ticket.type;
    const status = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${ticket.status}`;
    badge.textContent = statusLabels[ticket.status];
    status.append(badge);
    const priority = document.createElement('td');
    priority.className = `priority ${ticket.priority}`;
    priority.textContent = ticket.priority[0].toUpperCase() + ticket.priority.slice(1);
    const technicalCell = document.createElement('td');
    const technician = document.createElement('span');
    technician.className = 'ticket-technician';
    technician.textContent = ticket.technician;
    const note = document.createElement('span');
    note.className = 'ticket-note';
    note.textContent = ticket.technical_notes || 'Sem consideração técnica registrada';
    note.title = ticket.technical_notes || '';
    technicalCell.append(technician, note);
    row.append(subjectCell, type, status, priority, technicalCell);
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
  if (window.dashboardData) {
    drawResolutionChart(window.dashboardData.dailyResolution);
    drawStatusChart(window.dashboardData.statusBreakdown);
  }
});

window.dashboardData = null;
function renderDashboard(data) {
  updateDashboardView(data);
}

initializeDates();
loadDashboard();
window.setInterval(loadDashboard, 60_000);
