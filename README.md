# Dashboard Administrativo — Chamados e pedidos

Aplicação administrativa com dois módulos independentes: chamados técnicos do Thindesk e pedidos de lanchonete/pizzaria. Cada módulo possui painel, filtros, indicadores, modelo de dados e endpoints REST próprios. O projeto é autocontido e usa dados fictícios de demonstração.

> **Limite da integração:** não foram fornecidos o banco/API oficial do Thindesk nem a origem real dos pedidos. Portanto, a solução demonstra a integração entre os painéis, APIs e uma base SQLite local; a conexão às fontes oficiais depende de seus contratos, credenciais e regras de negócio.

## Requisitos

- Node.js 22.13 ou superior (utiliza `node:sqlite`).

## Executar

```powershell
node server/index.js
```

- Painel de chamados: [http://localhost:3000](http://localhost:3000)
- Painel de pedidos: [http://localhost:3000/orders](http://localhost:3000/orders)

A base `data/thindesk.sqlite`, os esquemas e índices são criados automaticamente. Os dados demonstrativos de cada domínio só são inseridos quando suas tabelas estão vazias. A base local é excluída do Git.

Opcionalmente, configure `PORT` e `DB_PATH` antes de iniciar. Para executar os testes:

```powershell
npm test
```

No PowerShell com política que bloqueie scripts, use `npm.cmd test`.

## Requisitos funcionais atendidos

| Requisito | Implementação |
|---|---|
| RF01 — Indicadores gerais | Total, abertos (inclui aguardando), em andamento, resolvidos e média de horas até resolução. |
| RF02 — Atendidos por período | Gráfico de chamados resolvidos por dia, agrupados pela data de resolução. |
| RF03 — Situação | Distribuição dos chamados por status. |
| RF04 — Tipos atendidos | Ranking de categorias dos chamados resolvidos. |
| RF05 — Filtros | Intervalo de datas, status e tipo, aplicados às consultas do painel. |
| RF06 — Integração com API | Interface consome os endpoints REST implementados pela aplicação. |
| RF07 — Atualização e tratamento | Atualização manual e automática, validação na API, estado de carregamento e erros exibidos no painel. |

O módulo de pedidos aplica indicadores, gráficos, filtros e atualização ao domínio de pedidos, sem misturar status ou regras de chamados.

## Módulos

### Chamados técnicos — `/`

- Indicadores de total, em aberto, em andamento, resolvidos e tempo médio de resolução.
- Série diária de resoluções, distribuição por status e ranking dos tipos mais atendidos.
- Filtros de período, status e categoria.
- Chamados recentes com solicitante, responsável técnico e considerações técnicas.

### Pedidos da lanchonete — `/orders`

- Indicadores de total, em aberto, em preparo, entregues e vendas dos pedidos concluídos.
- Série diária de pedidos entregues, distribuição por status e categorias de itens mais vendidos.
- Filtros de período, status e modalidade (entrega, retirada ou consumo no local).
- Pedidos recentes e respectivos itens.

Ambos os painéis são responsivos, atualizam os dados automaticamente a cada 60 segundos e exibem falhas da API.

## API

Todos os endpoints são de consulta HTTP `GET`. Os endpoints de dashboard e listagem aceitam `from=AAAA-MM-DD` e `to=AAAA-MM-DD`; sem datas, usam os últimos 30 dias. As datas, status e categorias são validados. Intervalo invertido ou filtros inválidos retornam `400` com `{ "error": "..." }`. Recurso inexistente retorna `404`, método diferente de GET retorna `405`, e erros inesperados retornam `500` e são registrados no servidor.

| Endpoint | Descrição |
|---|---|
| `GET /api/health` | Verifica disponibilidade da API e do SQLite. |
| `GET /api/dashboard` | Agregados, série diária, status, ranking e chamados recentes. |
| `GET /api/tickets` | Lista até 100 chamados no intervalo filtrado. |
| `GET /api/orders/dashboard` | Agregados de vendas, série de entregas, status, categorias e pedidos recentes. |
| `GET /api/orders` | Lista até 100 pedidos no intervalo filtrado. |

Os filtros de chamado usam `status=aberto|em_andamento|aguardando|resolvido` e `type=Hardware|Rede|Software|Impressora|Acesso`. Os filtros de pedido usam `status=recebido|preparando|pronto|entregue|cancelado` e `type=delivery|retirada|mesa`. Os domínios têm status e filtros independentes.

### Saúde

`GET /api/health` retorna `200`:

```json
{ "status": "ok", "database": "sqlite" }
```

### Dashboard de chamados

Exemplo: `GET /api/dashboard?from=2026-10-01&to=2026-10-31&status=resolvido&type=Rede`

```json
{
  "period": { "from": "2026-10-01", "to": "2026-10-31" },
  "summary": {
    "total": 12,
    "open": 0,
    "inProgress": 0,
    "waiting": 0,
    "resolved": 12,
    "averageResolutionHours": 4.5
  },
  "dailyResolution": [{ "date": "2026-10-01", "total": 2 }],
  "statusBreakdown": [{ "status": "aberto", "label": "Aberto", "total": 0 }],
  "resolvedByType": [{ "type": "Rede", "total": 12 }],
  "ticketTypes": ["Hardware", "Rede", "Software", "Impressora", "Acesso"],
  "latestTickets": []
}
```

`dailyResolution` inclui todos os dias do período, inclusive dias sem fechamentos. `statusBreakdown` retorna os quatro status. Os valores do exemplo variam conforme os dados consultados.

### Listagem de chamados

`GET /api/tickets?from=2026-10-01&to=2026-10-31` retorna no máximo 100 registros por data de abertura:

```json
{
  "total": 1,
  "items": [{
    "id": 1,
    "requester": "Ana Souza",
    "subject": "Computador não liga",
    "type": "Hardware",
    "status": "resolvido",
    "priority": "alta",
    "technician": "Marina Oliveira",
    "technical_notes": "Diagnóstico realizado e solução aplicada.",
    "created_at": "2026-10-12T12:00:00.000Z",
    "closed_at": "2026-10-12T16:00:00.000Z"
  }]
}
```

### Dashboard de pedidos

Exemplo: `GET /api/orders/dashboard?from=2026-10-01&to=2026-10-31&status=entregue&type=delivery`

```json
{
  "period": { "from": "2026-10-01", "to": "2026-10-31" },
  "summary": {
    "total": 60,
    "pending": 18,
    "preparing": 7,
    "ready": 4,
    "delivered": 34,
    "revenueCents": 142590,
    "averageFulfillmentMinutes": 42.5
  },
  "dailyOrders": [{ "date": "2026-10-01", "total": 3 }],
  "statusBreakdown": [{ "status": "recebido", "label": "Recebido", "total": 5 }],
  "topCategories": [{ "category": "Pizzas", "quantity": 28, "orders": 20 }],
  "orderTypes": [
    { "value": "delivery", "label": "Entrega" },
    { "value": "retirada", "label": "Retirada" },
    { "value": "mesa", "label": "Consumo no local" }
  ],
  "latestOrders": []
}
```

`revenueCents` é um inteiro em centavos. A média de atendimento usa minutos entre criação e entrega. A série agrupa pedidos pela data de entrega; cards e lista recente consideram a data de criação. Categorias são ranqueadas pela quantidade de itens dos pedidos entregues.

### Listagem de pedidos

`GET /api/orders?from=2026-10-01&to=2026-10-31` retorna até 100 pedidos por data de criação, com cliente, modalidade, status, total em centavos, observações, itens e timestamps.

## Modelo de dados

### Chamados — `tickets`

| Campo | Tipo/regra |
|---|---|
| `id` | `INTEGER`, chave primária. |
| `requester`, `subject` | `TEXT`, obrigatórios. |
| `type` | `TEXT`: Hardware, Rede, Software, Impressora ou Acesso. |
| `status` | `TEXT`: `aberto`, `em_andamento`, `aguardando` ou `resolvido`. |
| `priority` | `TEXT`: `baixa`, `media`, `alta` ou `critica`. |
| `technician` | `TEXT`, responsável técnico. |
| `technical_notes` | `TEXT`, diagnóstico e considerações técnicas. |
| `created_at`, `updated_at` | `TEXT`, timestamps ISO 8601 UTC. |
| `closed_at` | `TEXT` ISO 8601 UTC ou `NULL`, data da resolução. |

### Pedidos — `orders` e `order_items`

`orders` registra cliente, modalidade (`delivery`, `retirada`, `mesa`), status (`recebido`, `preparando`, `pronto`, `entregue`, `cancelado`), total em centavos, observações e timestamps de criação, atualização e entrega.

`order_items` relaciona-se ao pedido por chave estrangeira e registra nome do produto, categoria, quantidade e preço unitário em centavos. Valores monetários inteiros evitam erros de arredondamento; a exclusão do pedido remove seus itens por cascata.

Índices dão suporte a consultas temporais e por status/categoria. As tabelas usam restrições de domínio e integridade referencial.

## Regras de consulta

- Cards, distribuição de status e lista de recentes usam `created_at` no período.
- Gráficos de chamados atendidos, tempo médio e ranking de tipos usam `closed_at`.
- A série diária de pedidos usa data de entrega; os cards e recentes usam data de criação.
- O card “Em aberto” de chamados agrega `aberto` e `aguardando`.
- O tempo médio dos chamados mede horas entre abertura e resolução; sem resoluções no intervalo, retorna zero.
- Filtros de status e tipo/modalidade são adicionais aos de data. Ao selecionar status não resolvido, gráficos de resolução podem ficar zerados.
- Timestamps e limites de consulta usam UTC.
- Consultas SQL usam parâmetros vinculados, e não concatenam valores de filtros.

## Arquitetura e decisões

1. **Domínios separados:** a contextualização pede chamados Thindesk, enquanto o objetivo cita pedidos. Os módulos, APIs, tabelas, estados e regras são separados para atender ambos sem misturar conceitos.
2. **Node.js e módulos nativos:** servidor HTTP e `node:sqlite` mantêm a execução simples e sem dependências externas; requer Node 22.13+.
3. **SQLite:** adequado à demonstração local, com esquema, índices e dados fictícios criados automaticamente.
4. **SQL parametrizado:** protege as consultas contra montagem insegura de SQL com valores de entrada.
5. **Interface sem framework:** HTML, CSS, JavaScript e gráficos Canvas, sem etapa de build.
6. **Integração real:** requer URL, credenciais, esquema e regras oficiais do Thindesk e do sistema de pedidos, que não foram fornecidos.

## Apresentação — roteiro de até 3 minutos

Grave a tela com `node server/index.js` em execução e os painéis abertos. Este roteiro é apoio para a gravação; o vídeo final precisa ser gravado e adicionado ao repositório.

### Roteiro sugerido — 2min50s

- **0:00–0:25 | Contexto:** “O enunciado traz dois contextos: chamados técnicos do Thindesk e pedidos de lanchonete/pizzaria. Para atender aos dois sem misturar regras, esta solução tem dois painéis e APIs independentes.”
- **0:25–1:05 | Chamados técnicos:** “No painel Thindesk, os cards acompanham total, chamados em aberto, em andamento e resolvidos. Os gráficos mostram resoluções diárias e status; a lista inclui responsável e considerações técnicas. Posso filtrar por período, status e tipo de chamado.”
- **1:05–1:45 | Pedidos:** “No módulo de pedidos, os indicadores mostram volume, pedidos em aberto, em preparo e entregues, com o total de vendas. A série exibe entregas por dia, a distribuição acompanha o status e o ranking identifica as categorias mais vendidas. Filtros de período, status e modalidade atualizam o painel.”
- **1:45–2:20 | API e dados:** “As APIs REST dos dois módulos têm endpoints de consulta e agregação, usam SQLite e validam as entradas. O modelo de pedidos relaciona pedidos e itens e armazena valores em centavos. Os gráficos distinguem data de abertura da data de atendimento.”
- **2:20–2:50 | Decisões e integração:** “Os dados atuais são demonstrativos, não dados reais do Thindesk ou de uma lanchonete. Para integração real precisamos da URL, credenciais e esquema oficiais das fontes. O README detalha modelos, endpoints e as regras adotadas; o projeto inclui testes automatizados.”

### Capturas recomendadas

1. Painel de chamados com indicadores, gráfico e notas técnicas.
2. Painel de pedidos com indicadores de vendas, gráfico e categorias.
3. Aplicação dos filtros em cada domínio.
4. Endpoints `/api/dashboard` e `/api/orders/dashboard` com suas respostas JSON.
5. README e testes no repositório.

## Branch e entregáveis

O branch de implementação é `feature/dashboard-admin-api`. Este README reúne a análise, modelo de dados, contratos da API, decisões de projeto e roteiro de apresentação. O vídeo final precisa ser gravado e adicionado ao repositório.
