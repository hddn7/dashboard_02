# Dashboard administrativo — Chamados e pedidos

Aplicação administrativa com dois módulos independentes, cobrindo os dois domínios presentes no enunciado: chamados técnicos do Thindesk e pedidos de lanchonete/pizzaria. Cada módulo tem seu próprio painel, filtros, indicadores, modelo de dados e endpoints REST. O projeto é autocontido e inclui dados demonstrativos fictícios gerados no primeiro início.

## Requisitos

- Node.js 22.13 ou superior (utiliza `node:sqlite`).

## Executar

```powershell
node server/index.js
```

Abra [http://localhost:3000](http://localhost:3000) para o painel Thindesk ou [http://localhost:3000/orders](http://localhost:3000/orders) para pedidos. A base `data/thindesk.sqlite` e os esquemas são criados automaticamente; cada conjunto de demonstração só é inserido quando sua tabela está vazia. A base local está excluída do Git.

Opcionalmente, configure `PORT` e `DB_PATH` antes de iniciar. Para executar os testes:

```powershell
npm test
```

No PowerShell com política que bloqueie scripts, use `npm.cmd test`.

## Módulos

### Chamados técnicos — `/`

- Total, em aberto, em andamento, resolvidos e tempo médio de resolução.
- Série diária de chamados resolvidos, situação por status e tipos mais atendidos.
- Filtros por intervalo, status e categoria; chamados recentes incluem responsável e considerações técnicas.

### Pedidos da lanchonete — `/orders`

- Total, em aberto, em preparo, entregues e vendas dos pedidos concluídos.
- Série diária de pedidos entregues, situação por status e categorias de itens mais vendidos.
- Filtros por intervalo, status e modalidade (entrega, retirada ou consumo no local); lista pedidos e itens.

Ambos os painéis são responsivos, atualizam os dados automaticamente a cada 60 segundos e exibem falhas da API.

## API

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/health` | Verifica disponibilidade da API e do SQLite. |
| `GET` | `/api/dashboard` | Agregados, série diária, status, ranking e chamados recentes. |
| `GET` | `/api/tickets` | Lista até 100 chamados no intervalo filtrado. |
| `GET` | `/api/orders/dashboard` | Agregados de vendas, série de entregas, status, categorias e pedidos recentes. |
| `GET` | `/api/orders` | Lista até 100 pedidos no intervalo filtrado. |

Todos os recursos de consulta aceitam `from=AAAA-MM-DD` e `to=AAAA-MM-DD`; cada domínio valida seus próprios filtros de `status` e `type`. Chamados e pedidos têm status separados, sem misturar domínios. Sem datas, as APIs usam os últimos 30 dias. Detalhes de contratos, esquemas e regras estão em [docs/arquitetura-api.md](docs/arquitetura-api.md).

## Entregáveis de apresentação

O documento de análise, modelo de dados, contratos e decisões está em [docs/arquitetura-api.md](docs/arquitetura-api.md). O roteiro cronometrado da demonstração de até três minutos está em [docs/apresentacao.md](docs/apresentacao.md).

## Gitflow e publicação

O branch de trabalho desta implementação é `feature/dashboard-admin-api`. O workspace não possui remoto GitHub configurado nem ferramenta de criação/publicação de repositórios: para publicar, configure um remoto para o repositório fornecido pelo responsável e envie esta branch. O vídeo final precisa ser gravado e adicionado ao repositório; este ambiente não tem ferramenta de gravação de tela ou codificação de vídeo disponível. O roteiro de gravação está em [docs/apresentacao.md](docs/apresentacao.md).
