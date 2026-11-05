# Análise e projeto — Dashboard do Thindesk

## Escopo

O painel atende ao responsável pela operação de chamados técnicos. A interface e a API usam o mesmo servidor; o navegador consulta `/api` e o servidor agrega os dados persistidos em SQLite. Os dados iniciais são fictícios e existem para demonstração; em produção, a origem deve ser substituída ou sincronizada com o banco oficial do Thindesk.

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

Datas inválidas, status/categorias desconhecidos e intervalo invertido retornam `400` com `{ "error": "..." }`. Recurso inexistente retorna `404`; método diferente de GET retorna `405`; erros inesperados retornam `500` e são registrados no servidor.

## Regras de consulta

- `total`, distribuição de status, cards e lista de recentes filtram `created_at` pelo intervalo selecionado.
- Gráfico de atendidos, tempo médio e ranking de categorias filtram `closed_at`, pois representam trabalho concluído no período.
- Status e tipo são filtros adicionais em ambas as consultas. Ao filtrar por um status não resolvido, os gráficos de resolução naturalmente podem ficar zerados.
- O card “Em aberto” agrega `aberto` e `aguardando`.
- O tempo médio é calculado em horas entre abertura e resolução; se não houver resoluções no intervalo, o valor é zero.
- Todos os timestamps e os limites das consultas usam UTC; a interface informa essa convenção.

## Arquitetura e decisões

1. **Node.js e módulos nativos:** servidor HTTP e `node:sqlite` evitam dependências externas e tornam a execução simples em Node 22.13+.
2. **SQLite:** adequado para demonstração local, com criação automática do esquema e índices. Dados demonstrativos são inseridos apenas quando a tabela está vazia.
3. **SQL parametrizado:** valores dos filtros são vinculados como parâmetros, evitando montar consultas com entrada de usuário.
4. **Aplicação web sem framework:** HTML, CSS e JavaScript entregam layout responsivo e gráficos Canvas sem dependências de build.
5. **Origem de dados:** esta entrega implementa uma base de demonstração e contratos prontos para consumo. A conexão ao banco real/API existente do Thindesk depende de credenciais, esquema e ambiente de integração fornecidos pelo sistema; não foram presumidos.

## Execução e verificação

Requer Node.js 22.13+. Execute `node server/index.js` e acesse `http://localhost:3000`. Testes de contrato e filtros: `npm test`.
