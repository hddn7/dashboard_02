const rotulosStatus = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido'
};
const coresStatus = {
  aberto: '#e5a944',
  em_andamento: '#8b71dc',
  aguardando: '#7d8794',
  resolvido: '#42b584'
};
const formatadorNumerico = new Intl.NumberFormat('pt-BR');
const elementos = Object.fromEntries([
  'fromDate', 'toDate', 'statusFilter', 'typeFilter', 'applyFilters', 'clearFilters',
  'refreshButton', 'lastUpdated', 'errorBanner', 'metricTotal', 'metricOpen', 'metricProgress',
  'metricResolved', 'averageResolution', 'resolutionChart', 'resolutionEmpty',
  'statusChart', 'statusTotal', 'statusLegend', 'typeRanking', 'ticketRows'
].map((identificador) => [identificador, document.getElementById(identificador)]));

function valorCampoData(data) {
  return new Date(data.getTime() - data.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function inicializarDatas() {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 29);
  elementos.fromDate.value = valorCampoData(inicio);
  elementos.toDate.value = valorCampoData(hoje);
}

function montarParametrosConsulta() {
  const parametros = new URLSearchParams({
    from: elementos.fromDate.value,
    to: elementos.toDate.value
  });
  if (elementos.statusFilter.value) parametros.set('status', elementos.statusFilter.value);
  if (elementos.typeFilter.value) parametros.set('type', elementos.typeFilter.value);
  return parametros.toString();
}

async function carregarPainel() {
  elementos.errorBanner.hidden = true;
  elementos.applyFilters.disabled = true;
  try {
    const resposta = await fetch(`/api/dashboard?${montarParametrosConsulta()}`);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.error ?? 'Não foi possível carregar o painel.');
    exibirPainel(dados);
    elementos.lastUpdated.textContent = `Atualizado às ${new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date())}`;
  } catch (erro) {
    elementos.errorBanner.textContent = `Falha ao atualizar os dados: ${erro.message}`;
    elementos.errorBanner.hidden = false;
  } finally {
    elementos.applyFilters.disabled = false;
  }
}

function atualizarVisualizacaoPainel(dados) {
  window.dadosPainel = dados;
  const { summary: resumo } = dados;
  elementos.metricTotal.textContent = formatadorNumerico.format(resumo.total);
  elementos.metricOpen.textContent = formatadorNumerico.format(resumo.open + resumo.waiting);
  elementos.metricProgress.textContent = formatadorNumerico.format(resumo.inProgress);
  elementos.metricResolved.textContent = formatadorNumerico.format(resumo.resolved);
  elementos.averageResolution.textContent = `Média de resolução: ${resumo.averageResolutionHours.toLocaleString('pt-BR')} h`;
  elementos.statusTotal.textContent = formatadorNumerico.format(resumo.total);
  preencherTipos(dados.ticketTypes);
  desenharGraficoResolucao(dados.dailyResolution);
  desenharGraficoStatus(dados.statusBreakdown);
  exibirRanking(dados.resolvedByType);
  exibirChamados(dados.latestTickets);
}

function preencherTipos(tipos) {
  const selecionado = elementos.typeFilter.value;
  elementos.typeFilter.replaceChildren(new Option('Todos os tipos', ''));
  for (const tipo of tipos) elementos.typeFilter.add(new Option(tipo, tipo));
  elementos.typeFilter.value = selecionado;
}

function desenharGraficoResolucao(registros) {
  const tela = elementos.resolutionChart;
  const contexto = prepararTela(tela);
  const largura = tela.clientWidth;
  const altura = tela.clientHeight;
  elementos.resolutionEmpty.hidden = registros.some((registro) => registro.total > 0);
  if (!registros.length) return;

  const margens = { top: 16, right: 12, bottom: 31, left: 31 };
  const larguraGrafico = largura - margens.left - margens.right;
  const alturaGrafico = altura - margens.top - margens.bottom;
  const maximo = Math.max(4, Math.ceil(Math.max(...registros.map((registro) => registro.total)) / 2) * 2);
  contexto.font = '9px DM Sans, sans-serif';
  contexto.textAlign = 'right';
  contexto.textBaseline = 'middle';
  for (let marca = 0; marca <= 4; marca += 1) {
    const posicaoY = margens.top + alturaGrafico * marca / 4;
    contexto.strokeStyle = '#edf0f5';
    contexto.lineWidth = 1;
    contexto.beginPath();
    contexto.moveTo(margens.left, posicaoY);
    contexto.lineTo(largura - margens.right, posicaoY);
    contexto.stroke();
    contexto.fillStyle = '#a1a8b4';
    contexto.fillText(String(Math.round(maximo * (4 - marca) / 4)), margens.left - 8, posicaoY);
  }

  const intervalo = registros.length > 1 ? larguraGrafico / (registros.length - 1) : larguraGrafico;
  const pontos = registros.map((registro, indice) => ({
    x: margens.left + (registros.length > 1 ? intervalo * indice : larguraGrafico / 2),
    y: margens.top + alturaGrafico * (1 - registro.total / maximo),
    registro
  }));
  if (pontos.length > 1) {
    const gradiente = contexto.createLinearGradient(0, margens.top, 0, altura - margens.bottom);
    gradiente.addColorStop(0, 'rgba(101, 113, 125, .16)');
    gradiente.addColorStop(1, 'rgba(101, 113, 125, 0)');
    contexto.beginPath();
    contexto.moveTo(pontos[0].x, altura - margens.bottom);
    for (const ponto of pontos) contexto.lineTo(ponto.x, ponto.y);
    contexto.lineTo(pontos.at(-1).x, altura - margens.bottom);
    contexto.closePath();
    contexto.fillStyle = gradiente;
    contexto.fill();
    contexto.beginPath();
    pontos.forEach((ponto, indice) => {
      if (indice === 0) contexto.moveTo(ponto.x, ponto.y);
      else contexto.lineTo(ponto.x, ponto.y);
    });
    contexto.strokeStyle = '#65717d';
    contexto.lineWidth = 2;
    contexto.lineJoin = 'round';
    contexto.stroke();
  }

  const quantidadeRotulos = Math.min(6, registros.length);
  const indicesRotulos = new Set(Array.from({ length: quantidadeRotulos }, (_, indice) =>
    quantidadeRotulos === 1 ? 0 : Math.round(indice * (registros.length - 1) / (quantidadeRotulos - 1))
  ));
  contexto.textAlign = 'center';
  contexto.textBaseline = 'top';
  contexto.fillStyle = '#9aa2af';
  for (const indice of indicesRotulos) {
    const ponto = pontos[indice];
    const rotulo = new Date(`${ponto.registro.date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    contexto.fillText(rotulo.replace('.', ''), ponto.x, altura - margens.bottom + 10);
  }
}

function prepararTela(tela) {
  const proporcao = window.devicePixelRatio || 1;
  const largura = tela.clientWidth;
  const altura = tela.clientHeight;
  tela.width = Math.round(largura * proporcao);
  tela.height = Math.round(altura * proporcao);
  const contexto = tela.getContext('2d');
  contexto.scale(proporcao, proporcao);
  return contexto;
}

function desenharGraficoStatus(registros) {
  const tela = elementos.statusChart;
  const contexto = prepararTela(tela);
  const total = registros.reduce((soma, registro) => soma + registro.total, 0);
  const centro = tela.clientWidth / 2;
  const raio = Math.min(tela.clientWidth, tela.clientHeight) * 0.43;
  const espessura = 17;
  let angulo = -Math.PI / 2;
  contexto.lineWidth = espessura;
  contexto.lineCap = 'butt';
  for (const registro of registros) {
    const extensao = total ? (registro.total / total) * Math.PI * 2 : Math.PI * 2;
    contexto.beginPath();
    contexto.arc(centro, centro, raio, angulo, angulo + extensao);
    contexto.strokeStyle = registro.total ? coresStatus[registro.status] : '#edf0f5';
    contexto.stroke();
    angulo += extensao;
  }

  elementos.statusLegend.replaceChildren(...registros.map((registro) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const ponto = document.createElement('span');
    ponto.className = 'legend-dot';
    ponto.style.backgroundColor = coresStatus[registro.status];
    const rotulo = document.createElement('span');
    rotulo.textContent = registro.label;
    const valor = document.createElement('span');
    valor.className = 'legend-value';
    valor.textContent = formatadorNumerico.format(registro.total);
    item.append(ponto, rotulo, valor);
    return item;
  }));
}

function exibirRanking(registros) {
  const maximo = Math.max(1, ...registros.map((registro) => registro.total));
  if (!registros.length) {
    elementos.typeRanking.innerHTML = '<div class="empty-state">Nenhum chamado resolvido no período.</div>';
    return;
  }
  elementos.typeRanking.replaceChildren(...registros.slice(0, 5).map((registro) => {
    const item = document.createElement('div');
    item.className = 'ranking-item';
    const rotulo = document.createElement('span');
    rotulo.textContent = registro.type;
    const trilho = document.createElement('span');
    trilho.className = 'ranking-track';
    const preenchimento = document.createElement('span');
    preenchimento.className = 'ranking-fill';
    preenchimento.style.display = 'block';
    preenchimento.style.width = `${registro.total / maximo * 100}%`;
    trilho.append(preenchimento);
    const quantidade = document.createElement('span');
    quantidade.className = 'ranking-count';
    quantidade.textContent = formatadorNumerico.format(registro.total);
    item.append(rotulo, trilho, quantidade);
    return item;
  }));
}

function exibirChamados(chamados) {
  if (!chamados.length) {
    elementos.ticketRows.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum chamado encontrado para os filtros aplicados.</td></tr>';
    return;
  }
  elementos.ticketRows.replaceChildren(...chamados.map((chamado) => {
    const linha = document.createElement('tr');
    const celulaAssunto = document.createElement('td');
    const assunto = document.createElement('span');
    assunto.className = 'ticket-subject';
    assunto.textContent = chamado.subject;
    const identificador = document.createElement('span');
    identificador.className = 'ticket-id';
    identificador.textContent = `#TD-${String(chamado.id).padStart(4, '0')} · ${chamado.requester}`;
    celulaAssunto.append(assunto, identificador);

    const tipo = document.createElement('td');
    tipo.textContent = chamado.type;
    const status = document.createElement('td');
    const etiqueta = document.createElement('span');
    etiqueta.className = `badge ${chamado.status}`;
    etiqueta.textContent = rotulosStatus[chamado.status];
    status.append(etiqueta);
    const prioridade = document.createElement('td');
    prioridade.className = `priority ${chamado.priority}`;
    prioridade.textContent = chamado.priority[0].toUpperCase() + chamado.priority.slice(1);
    const celulaTecnica = document.createElement('td');
    const tecnico = document.createElement('span');
    tecnico.className = 'ticket-technician';
    tecnico.textContent = chamado.technician;
    const observacao = document.createElement('span');
    observacao.className = 'ticket-note';
    observacao.textContent = chamado.technical_notes || 'Sem consideração técnica registrada';
    observacao.title = chamado.technical_notes || '';
    celulaTecnica.append(tecnico, observacao);
    linha.append(celulaAssunto, tipo, status, prioridade, celulaTecnica);
    return linha;
  }));
}

elementos.applyFilters.addEventListener('click', carregarPainel);
elementos.refreshButton.addEventListener('click', carregarPainel);
elementos.clearFilters.addEventListener('click', () => {
  inicializarDatas();
  elementos.statusFilter.value = '';
  elementos.typeFilter.value = '';
  carregarPainel();
});
window.addEventListener('resize', () => {
  if (window.dadosPainel) {
    desenharGraficoResolucao(window.dadosPainel.dailyResolution);
    desenharGraficoStatus(window.dadosPainel.statusBreakdown);
  }
});

window.dadosPainel = null;
function exibirPainel(dados) {
  atualizarVisualizacaoPainel(dados);
}

inicializarDatas();
carregarPainel();
window.setInterval(carregarPainel, 60_000);
