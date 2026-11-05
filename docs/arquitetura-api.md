# Análise e projeto — Dashboard de chamados e pedidos

## Escopo

O enunciado inclui dois domínios: a contextualização exige chamados técnicos integrados ao Thindesk, enquanto o objetivo descreve pedidos de lanchonete/pizzaria. Para atender ambos sem misturar regras de negócio, a solução tem módulos independentes de chamados (`/`) e pedidos (`/orders`), APIs, tabelas e filtros separados. A interface e as APIs usam o mesmo servidor Node.js e banco SQLite. Os dados iniciais são fictícios e servem para demonstração; o banco oficial do Thindesk e a origem real dos pedidos não foram fornecidos.

## Requisitos atendidos

| Requisito | Implementação |
|---|---|
| RF01 — Indicadores gerais | Total, abertos (inclui aguardando), em andamento, resolvidos e média de horas até resolução. |
| RF02 — Atendidos por período | Gráfico de resolvidos por dia, consultado pela data de resolução. |
| RF03 — Situação | Gráfico de distribuição por status dos chamados abertos no período. |
| RF04 — Tipos atendidos | Ranking de categorias de chamados resolvidos. |
| RF05 — Filtros | Intervalo de datas, status e tipo, compartilhados pelas consultas do painel. |
| RF06 — Integração | Interface consome os endpoints REST servidos pela aplicação. |
| RF07 — Atualização e tratamento | Atualização manual/automática; loading por botão desabilitado, validação na API e erro visível no dashboard. |

O módulo de pedidos aplica os mesmos requisitos a pedidos recebidos, preparados, prontos, entregues ou cancelados: indicadores, entregas por período, distribuição de status, categorias de itens mais vendidos, filtros e atualização automática.

## Modelo de dados

### Entidade `tickets`

| Campo | Tipo SQLite | Regra |
|---|---|---|
| `id` | INTEGER | Chave primária autoincremental. |
| `requester` | TEXT | Solicitante, obrigatório. |
| `subject` | TEXT | Resumo do chamado, obrigatório. |
| `type` | TEXT | Categoria: Hardware, Rede, Software, Impressora ou Acesso. |
| `status` | TEXT | `aberto`, `em_andamento`, `aguardando` ou `resolvido`. |
| `priority` | TEXT | `baixa`, `media`, `alta` ou `critica`. |
| `technician` | TEXT | Responsável técnico. |
| `technical_notes` | TEXT | Considerações e diagnóstico técnico. |
| `created_at` | TEXT ISO 8601 UTC | Data de abertura. |
| `updated_at` | TEXT ISO 8601 UTC | Última atualização. |
| `closed_at` | TEXT ISO 8601 UTC ou NULL | Data de resolução. |

Índices suportam as consultas por datas de abertura/fechamento, status e categoria. Status e prioridade têm restrições de domínio no banco.

### Entidades `orders` e `order_items`

`orders` registra cliente, modalidade (`delivery`, `retirada`, `mesa`), status (`recebido`, `preparando`, `pronto`, `entregue`, `cancelado`), total em centavos, observações e timestamps de criação, atualização e entrega. `order_items` é relacionada por chave estrangeira ao pedido e armazena nome do produto, categoria, quantidade e preço unitário em centavos. A representação monetária inteira evita erros de arredondamento.

Índices em `orders` suportam filtros temporais, status e modalidade. A tabela de itens tem índice por pedido/categoria. Exclusão em cascata protege a integridade dos itens.

## Contratos HTTP

### `GET /api/health`

Resposta `200`:

```json
{ "status": "ok", "database": "sqlite" }
```

### `GET /api/dashboard?from=2026-10-01&to=2026-10-31&status=resolvido&type=Rede`

Todos os parâmetros são opcionais. As datas devem ser válidas no formato `AAAA-MM-DD`; `from` não pode ser posterior a `to`. Status e tipo são validados. Sem intervalo, usa os últimos 30 dias. Resposta `200`:

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

`dailyResolution` inclui todos os dias do intervalo, inclusive dias sem fechamentos. `statusBreakdown` sempre retorna os quatro status. A resposta ilustra a forma do contrato; os valores dependem da base consultada.

### `GET /api/tickets?from=2026-10-01&to=2026-10-31`

Aplica os mesmos filtros, retorna no máximo 100 registros por data de abertura:

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

### `GET /api/orders/dashboard?from=2026-10-01&to=2026-10-31&status=entregue&type=delivery`

Usa filtros de data comuns e status/modalidade válidos do domínio de pedidos. Retorna métricas operacionais e financeiras:

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

`revenueCents` é um inteiro em centavos; o frontend o formata como BRL. A média de atendimento usa minutos entre a criação e a entrega. A série diária agrupa pedidos pela data de entrega; os cards e a lista recente consideram a data de criação. Categorias são ranqueadas pela quantidade de itens nos pedidos entregues.

### `GET /api/orders?from=2026-10-01&to=2026-10-31`

Retorna até 100 pedidos por data de criação, com cliente, modalidade, status, total em centavos, observações, itens e timestamp. Aceita filtros `status=recebido|preparando|pronto|entregue|cancelado` e `type=delivery|retirada|mesa`.

Datas inválidas, status/categorias desconhecidos e intervalo invertido retornam `400` com `{ "error": "..." }`. Recurso inexistente retorna `404`; método diferente de GET retorna `405`; erros inesperados retornam `500` e são registrados no servidor.

## Regras de consulta

- `total`, distribuição de status, cards e lista de recentes filtram `created_at` pelo intervalo selecionado.
- Gráfico de atendidos, tempo médio e ranking de categorias filtram `closed_at`, pois representam trabalho concluído no período.
- Status e tipo são filtros adicionais em ambas as consultas. Ao filtrar por um status não resolvido, os gráficos de resolução naturalmente podem ficar zerados.
- O card “Em aberto” agrega `aberto` e `aguardando`.
- O tempo médio é calculado em horas entre abertura e resolução; se não houver resoluções no intervalo, o valor é zero.
- Todos os timestamps e os limites das consultas usam UTC; a interface informa essa convenção.
- APIs e schemas de pedidos são independentes dos de chamados; estados e categorias não são intercambiáveis.

## Arquitetura e decisões

1. **Domínios separados:** a divergência do enunciado é atendida por dois módulos isolados, sem compartilhar status ou métricas de negócio.
2. **Node.js e módulos nativos:** servidor HTTP e `node:sqlite` evitam dependências externas e tornam a execução simples em Node 22.13+.
3. **SQLite:** adequado para demonstração local, com criação automática de esquemas e índices. Dados demonstrativos de cada domínio são inseridos apenas quando sua tabela está vazia.
4. **SQL parametrizado:** valores dos filtros são vinculados como parâmetros, evitando montar consultas com entrada de usuário.
5. **Aplicação web sem framework:** HTML, CSS e JavaScript entregam layout responsivo e gráficos Canvas sem dependências de build.
6. **Origem de dados:** esta entrega implementa uma base de demonstração e contratos REST funcionais. A integração ao banco/API real do Thindesk e ao sistema real de pedidos requer URL, credenciais, esquema e regras de negócio oficiais, ainda não fornecidos.

## Execução e verificação

Requer Node.js 22.13+. Execute `node server/index.js` e acesse `http://localhost:3000`. Testes de contrato e filtros: `npm test`.
