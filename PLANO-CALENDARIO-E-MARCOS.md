# Plano de calendário editorial, publicações e marcos

Plano original da evolução editorial. Implementação autorizada em 09/09/2026. O fluxo entregue, regras exatas e limites de integração estão em [GUIA-EDITORIAL.md](GUIA-EDITORIAL.md). As seções abaixo preservam o escopo de referência; a pesquisa e a ilustração por IA são externas, assistidas por prompts/importação, enquanto calendário, marcos, RSS, templates e confirmação de publicação estão no sistema.

## Objetivo

Transformar o histórico financeiro em um calendário editorial contínuo, com várias semanas e meses planejados, sem confundir conteúdo previsto com conteúdo efetivamente publicado.

A compra diária continua sendo uma rotina independente, publicada todos os dias. O calendário abaixo trata dos conteúdos complementares.

## Rotina semanal fixa

| Dia | Conteúdo | Fonte | Formato sugerido |
|---|---|---|---|
| Segunda | Dificuldade da semana anterior: queda, taxa, disciplina ou ausência de compra | Dados da semana + observação registrada | Imagem única ou carrossel curto |
| Terça | Educação Bitcoin: satoshis, DCA, preço médio, taxas, volatilidade e custódia | Tema editorial + números reais quando aplicável | Carrossel educativo |
| Quarta | Taxa sem esconder: taxa do dia, da semana e acumulada | Compras e preços de execução | Imagem ou carrossel |
| Quinta | Comparação da semana: melhor/pior dia de compra, satoshis recebidos e preço médio | Compras e cotações salvas | Carrossel com comparação |
| Sexta | Radar Cripto da Semana: notícias, contexto e impacto possível | Pesquisa atualizada e fontes identificadas | Carrossel gerado com IA |
| Sábado | Resumo semanal: aportes, BTC, taxas, carteira e resultados | Sistema | Imagem + carrossel opcional |
| Domingo | Reflexão visual da semana: disciplina, paciência, queda ou constância | Dados do período + texto editorial | Imagem gerada por IA |

Cada item deve ter uma data planejada, prazo interno, estado, formato, canais e conteúdo-base. A rotina não deve criar uma publicação duplicada quando um marco coincidir com o post semanal; nesse caso, o calendário permite substituir, combinar ou adiar o item.

## Calendário para vários meses

O calendário deve ser gerado a partir de um mês inicial e um mês final, sempre usando o fuso `America/Sao_Paulo`. Cada data recebe automaticamente o conteúdo semanal correspondente. O usuário poderá:

- gerar 1, 3, 6 ou 12 meses;
- alterar o tema de uma data sem alterar as demais;
- pausar um item, reagendar ou marcar como conteúdo extra;
- adicionar uma observação editorial;
- visualizar apenas pendentes, atrasados, publicados ou marcos próximos;
- regenerar datas futuras sem modificar conteúdos já arquivados.

O calendário mensal também deve incluir o fechamento do mês no primeiro dia útil ou no dia escolhido pelo usuário, desde que use os dados do último fechamento válido do mês anterior. O texto precisa dizer se é “fechamento do mês” ou “parcial do mês”.

## Estados de um item

Os estados sugeridos são:

1. `planejado` — item criado pela rotina ou manualmente.
2. `dados_pendentes` — falta compra, cotação ou observação necessária.
3. `pronto_para_gerar` — período e fontes estão disponíveis.
4. `gerado` — imagem, legenda e, quando aplicável, carrossel foram criados.
5. `revisado` — usuário conferiu os números e o texto.
6. `publicado_parcialmente` — publicado em pelo menos um canal.
7. `publicado` — marcado como publicado em todos os canais selecionados.
8. `cancelado` — não será publicado, com motivo obrigatório.

“Gerado” não significa “publicado”. A aplicação deve manter essas etapas separadas.

## Confirmação de publicação

Cada item deve mostrar checkboxes independentes para Instagram, Threads e YouTube/Shorts, além de:

- data e hora da publicação por canal;
- URL da publicação, opcional;
- observação ou erro;
- usuário que confirmou, mesmo sendo uma conta única;
- botão “Marcar todos como publicados” com confirmação explícita;
- botão “Desfazer confirmação” que preserve o histórico da ação.

O estado do item é derivado dos canais selecionados. Se Instagram estiver publicado e Threads pendente, o item deve aparecer como `publicado_parcialmente`. O calendário deve destacar o dia atual e os itens atrasados, sem apagar nada automaticamente.

Não haverá publicação automática nas redes nesta fase. A confirmação representa que o usuário publicou manualmente.

## Conteúdos mensais

Para cada mês completo, o sistema poderá preparar:

- fechamento mensal;
- comparação com o mês anterior;
- total aportado, BTC acumulado, taxas e resultado;
- melhor e pior dia de compra;
- evolução do preço médio;
- ranking dos dias em que R$ 10 compraram mais e menos BTC;
- gráfico de aportes, carteira e resultado;
- “o que aprendi neste mês”;
- maior dificuldade do mês;
- balanço do que funcionou e foco do próximo mês.

O sistema deve bloquear o uso de uma cotação de fechamento inexistente e mostrar aviso quando o mês ainda estiver incompleto. Conteúdos mensais arquivados guardam o snapshot usado na geração.

## Regras de marcos

Os marcos são calculados a partir dos dados confirmados, e não a partir de posts publicados:

### Constância

7, 30, 60, 100, 180 e 365 dias desde o início. Definir se o marco mede dias corridos ou dias com compra; a primeira versão deve exibir os dois quando forem diferentes.

### Aportes

R$ 100, R$ 500, R$ 1.000, R$ 2.500, R$ 5.000, R$ 10.000 e valores configuráveis.

### Bitcoin acumulado

10 mil, 50 mil, 100 mil, 250 mil, 500 mil e 1 milhão de satoshis.

### Valor da carteira

Primeira passagem acima de R$ 100, R$ 500, R$ 1.000 e outros valores configuráveis. O marco só é considerado atingido com uma cotação salva e um snapshot válido.

### Eventos de desempenho

Primeiro mês positivo, recuperação de uma queda, melhor semana, maior taxa proporcional e primeiro mês completo.

Cada marco precisa guardar o valor atingido, data, cotação usada, conteúdo gerado e estado de publicação. Uma oscilação posterior não desfaz o marco. O mesmo marco não deve ser gerado duas vezes, mas o usuário pode solicitar uma nova versão manual.

## Radar Cripto da Semana

O Radar será o único item recorrente que exige pesquisa externa atualizada. Um agendamento semanal pode preparar um rascunho toda sexta-feira, mas o resultado precisa de revisão antes de ser tratado como pronto.

Fluxo planejado:

1. Buscar notícias publicadas desde o sábado anterior.
2. Priorizar fontes primárias, comunicados oficiais, órgãos reguladores, empresas e veículos reconhecidos.
3. Registrar URL, título, fonte, data de publicação e data do fato.
4. Escolher até cinco notícias.
5. Separar fato, contexto e possível impacto.
6. Gerar carrossel, legenda e texto para Threads/YouTube.
7. Informar “notícia”, “análise” ou “inferência” em cada página.
8. Exigir revisão manual para corrigir números, datas, tradução e tom.

Não incluir rumores sem identificação, previsões de preço, recomendação personalizada ou afirmação de que uma notícia determina o resultado da carteira. Se não houver notícias relevantes, gerar “Radar da semana: sem fatos relevantes para o desafio” ou permitir pular o item.

## Carrosséis

O sistema deve suportar uma arte de capa e páginas numeradas. Modelos iniciais:

- **Taxa sem esconder:** compra → taxa em BTC → conversão aproximada em reais → impacto no saldo → total acumulado.
- **Resumo semanal:** capa → aportes → BTC → taxas → carteira → resultado e observação.
- **Comparação:** melhor dia → pior dia → preço médio → satoshis recebidos → conclusão.
- **Educação:** conceito → exemplo real → cálculo → cuidado → resumo.
- **Radar:** capa → notícia 1 → notícia 2 → notícia 3 → contexto → ressalva.

Cada página deve ter texto curto, alto contraste, data da cotação e indicação de que o valor é estimado quando for o caso. O arquivo final deve ser exportável como PNGs individuais e, opcionalmente, PDF ou ZIP.

## Dados necessários no sistema

Além das tabelas atuais de compras, cotações e conteúdos, a evolução provavelmente precisará de:

- `editorial_templates`: tipo, dia da semana, nome, ativo e versão;
- `calendar_items`: data planejada, tipo, período, estado, prioridade, observação e versão do template;
- `content_channels`: item, canal, estado, data/hora, URL e observação;
- `milestone_definitions`: métrica, alvo, nome, ordem, ativo e regra;
- `milestone_events`: marco atingido, data, valor, cotação, snapshot e conteúdo relacionado;
- `news_items`: fonte, URL, título, datas, resumo, classificação e status de revisão;
- `carousel_pages`: conteúdo, ordem, texto, imagem e texto alternativo;
- `editorial_actions`: histórico de gerar, revisar, publicar, desfazer e cancelar.

As tabelas devem ter chaves únicas para evitar duplicatas: uma rotina semanal por data/tipo, um canal por item, uma definição por métrica/alvo e uma notícia por URL normalizada.

## Regras para gerar conteúdos

- Usar somente compras e cotações salvas até o corte do conteúdo.
- Não alterar um conteúdo arquivado quando uma compra for editada depois.
- Mostrar avisos de dia sem compra, cotação ausente, compra posterior ao corte ou fechamento inicial inválido.
- Manter aportes, taxas, BTC líquido e resultado em campos distintos.
- Recalcular com precisão completa e arredondar apenas na exibição.
- Salvar prompt, versão do template, dados usados e horário da geração para auditoria.
- Não publicar automaticamente nem guardar tokens de redes sociais nesta etapa.
- Permitir regenerar um rascunho sem apagar a versão anterior.

## Agendamentos futuros

Os agendamentos sugeridos são:

- diariamente: manutenção do calendário e identificação de itens atrasados;
- sexta-feira: rascunho do Radar Cripto da Semana;
- primeiro dia do mês: criação do calendário do mês seguinte;
- após o fechamento mensal: cálculo e criação dos marcos descobertos;
- sob demanda: geração de imagem, carrossel e legendas.

Como o plano gratuito pode atrasar a execução de cron, o sistema deve registrar o horário efetivo e nunca afirmar que uma tarefa foi executada no horário ideal sem evidência.

## Painéis e alertas

O painel editorial deve mostrar:

- calendário mensal com cores por estado;
- “hoje”, “próximos sete dias” e “atrasados”;
- próximos marcos e marcos já comemorados;
- conteúdos gerados sem confirmação de publicação;
- dias sem compra ou cotação;
- itens que precisam de revisão;
- histórico de alterações.

Alertas dentro do sistema são suficientes inicialmente. E-mail ou notificações externas podem ser avaliados depois.

## Ordem recomendada de implementação

1. Modelo de calendário e rotina semanal.
2. Tela mensal e estados dos itens.
3. Confirmação por canal e histórico de publicação.
4. Geração mensal e marcos.
5. Suporte a carrossel.
6. Radar semanal com pesquisa e revisão.
7. Agendamentos automáticos.
8. Exportação de calendário, ZIP de artes e relatório editorial.

## Critérios de aceite

- É possível gerar vários meses sem criar datas duplicadas.
- Uma compra diária não é confundida com um conteúdo complementar.
- Um item pode estar publicado no Instagram e pendente nos demais canais.
- A confirmação registra horário e pode ser desfeita sem apagar o histórico.
- Marcos atingidos aparecem uma única vez e permanecem atingidos mesmo após queda da cotação.
- Conteúdos mensais usam fechamento válido ou informam claramente que são parciais.
- Carrosséis preservam a ordem das páginas e permitem exportação.
- O Radar registra fontes, datas e revisão antes da publicação.
- Alterações em compras futuras não mudam snapshots arquivados.
- Backup inclui calendário, estados, marcos, fontes e versões de conteúdo.
