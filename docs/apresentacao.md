# Roteiro para vídeo de demonstração (até 3 minutos)

> Grave a tela com o servidor iniciado (`node server/index.js`) e a página aberta em `http://localhost:3000`. Este roteiro é o material de apoio; o arquivo de vídeo deve ser gravado e adicionado ao repositório.

## Roteiro sugerido — 2min30s

**0:00–0:20 | Contexto e objetivo**
“Este é o dashboard administrativo do Thindesk. A proposta é dar ao responsável pela operação uma visão rápida do volume, andamento e perfil dos chamados técnicos, apoiando a priorização da equipe.”

**0:20–0:50 | Indicadores e filtros**
“No topo estão o total de chamados, os que aguardam atendimento, os que estão em andamento e os resolvidos, além do tempo médio de resolução. O período pode ser alterado e combinado com filtros de status e categoria. Ao aplicar, o navegador consulta a API e atualiza os dados; também há atualização automática.”

**0:50–1:20 | Gráficos e operação**
“O gráfico de linha acompanha os chamados resolvidos por dia. O gráfico de rosca mostra a distribuição por status, e o ranking destaca as categorias mais atendidas. A tabela permite conferir os chamados recentes, suas prioridades e situação.”

**1:20–1:55 | API e dados**
“A aplicação expõe endpoints REST para saúde, agregados do dashboard e listagem de chamados. Os registros ficam em SQLite, com índices por datas, status e categoria. As datas inválidas e filtros desconhecidos são rejeitados pela API; falhas de atualização aparecem na própria tela.”

**1:55–2:25 | Decisões e próximos passos**
“Separei as métricas por significado: cards e status usam data de abertura; atendimentos e tempo médio usam data de resolução. A base inicial é demonstrativa. Para conectar ao ambiente real do Thindesk, é necessário configurar a fonte oficial e mapear seus campos ao modelo da API. O projeto e a documentação ficam no repositório.”

## Capturas recomendadas

1. Painel carregado com os indicadores e gráficos visíveis.
2. Aplicação de um período e categoria para mostrar a atualização integrada.
3. Endpoint `/api/dashboard` aberto no navegador ou terminal para evidenciar o contrato JSON.
4. README e documentação de arquitetura/API no repositório.
