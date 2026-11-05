# Roteiro para vídeo de demonstração (até 3 minutos)

> Grave a tela com o servidor iniciado (`node server/index.js`) e os painéis abertos em `http://localhost:3000` e `http://localhost:3000/orders`. Este roteiro é o material de apoio; o arquivo de vídeo deve ser gravado e adicionado ao repositório.

## Roteiro sugerido — 2min50s

**0:00–0:25 | Contexto**
“O enunciado traz dois contextos: chamados técnicos do Thindesk e pedidos de lanchonete/pizzaria. Para atender aos dois sem misturar regras, esta solução tem dois painéis e APIs independentes.”

**0:25–1:05 | Chamados técnicos**
“No painel Thindesk, os cards acompanham total, chamados em aberto, em andamento e resolvidos. Os gráficos mostram resoluções diárias e status; a lista inclui responsável e considerações técnicas. Posso filtrar por período, status e tipo de chamado.”

**1:05–1:45 | Pedidos**
“No módulo de pedidos, os indicadores mostram volume, pedidos em aberto, em preparo e entregues, com o total de vendas. A série exibe entregas por dia, a distribuição acompanha o status e o ranking identifica as categorias mais vendidas. Filtros de período, status e modalidade atualizam o painel.”

**1:45–2:20 | API e dados**
“As APIs REST dos dois módulos têm endpoints de consulta e agregação, usam SQLite e validam as entradas. O modelo de pedidos relaciona pedidos e itens e armazena valores em centavos. Os gráficos distinguem data de abertura da data de atendimento.”

**2:20–2:50 | Decisões e integração**
“Os dados atuais são demonstrativos, não dados reais do Thindesk ou de uma lanchonete. Para integração real precisamos da URL, credenciais e esquema oficiais das fontes. A documentação detalha modelos, endpoints e as regras adotadas; o projeto inclui testes automatizados.”

## Capturas recomendadas

1. Painel de chamados carregado com indicadores, gráfico e notas técnicas.
2. Painel de pedidos com indicadores de vendas, gráfico e categorias.
3. Aplicação de filtros em cada domínio.
4. Endpoints `/api/dashboard` e `/api/orders/dashboard` para evidenciar os contratos JSON.
5. README, documentação de arquitetura/API e testes no repositório.
