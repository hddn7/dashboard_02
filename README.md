# Thindesk — Dashboard administrativo

Dashboard responsivo para acompanhamento de chamados técnicos, com API REST própria e persistência SQLite. O projeto é autocontido, não precisa de instalação de dependências externas e inclui dados demonstrativos gerados no primeiro início.

## Requisitos

- Node.js 22.13 ou superior (utiliza `node:sqlite`).

## Executar

```powershell
node server/index.js
```

Abra [http://localhost:3000](http://localhost:3000). A base `data/thindesk.sqlite` é criada automaticamente; os chamados demonstrativos só são inseridos quando a tabela está vazia. A base local está excluída do Git.

Opcionalmente, configure `PORT` e `DB_PATH` antes de iniciar. Para executar os testes:

```powershell
npm test
```

No PowerShell com política que bloqueie scripts, use `npm.cmd test`.

## O que o painel apresenta

- Indicadores de volume, chamados abertos, em andamento, resolvidos e tempo médio de resolução.
- Série diária de chamados resolvidos, distribuição por status e ranking de tipos.
- Filtros por intervalo, status e tipo, lista de chamados recentes e atualização automática a cada 60 segundos.
- Tratamento visível de falhas de rede e de validação da API.

## API

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/health` | Verifica disponibilidade da API e do SQLite. |
| `GET` | `/api/dashboard` | Agregados, série diária, status, ranking e chamados recentes. |
| `GET` | `/api/tickets` | Lista até 100 chamados no intervalo filtrado. |

Filtros opcionais: `from=AAAA-MM-DD`, `to=AAAA-MM-DD`, `status=aberto|em_andamento|aguardando|resolvido` e `type=Hardware|Rede|Software|Impressora|Acesso`. Os filtros de status e tipo são aplicados às consultas de chamados e aos agregados. A série de atendimentos e o tempo médio são agrupados pela data de resolução; os demais indicadores e a tabela consideram a data de abertura. Sem datas, a API usa os últimos 30 dias. Detalhes de contratos e decisões estão em [docs/arquitetura-api.md](docs/arquitetura-api.md).

## Entregáveis de apresentação

O documento de análise, modelo de dados, contratos e decisões está em [docs/arquitetura-api.md](docs/arquitetura-api.md). O roteiro cronometrado para gravar a demonstração de até três minutos está em [docs/apresentacao.md](docs/apresentacao.md).

## Gitflow e publicação

O branch de trabalho desta implementação é `feature/dashboard-admin-api`; publique-o em um repositório GitHub e abra um Pull Request para `main`. O vídeo final precisa ser gravado e adicionado ao repositório pelo responsável, pois não há gravação/publicação de vídeo configurada neste workspace.
