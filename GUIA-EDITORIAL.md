# Calendário, publicações e marcos

## Começar

A criação fica concentrada no **Calendário**. A página **Publicações** reúne os conteúdos gerados de todos os meses, incluindo marcos, com o status por rede. **Abrir conteúdo** dá acesso à mesma revisão, às artes, legendas, ao MP4 e às confirmações do Calendário. Itens com versões anteriores continuam acessíveis mesmo quando precisam ser gerados novamente. O **Arquivo anterior** preserva os conteúdos do fluxo antigo; a tela **Criar conteúdo** foi removida.

1. Abra **Calendário** e escolha o mês inicial, 1/3/6/12 meses e o dia de início dos conteúdos mensais.
2. Clique em **Gerar calendário**. Repetir a operação não duplica nem sobrescreve itens existentes.
3. Abra um cartão. Em **Planejamento e observações**, ajuste data, prazo, título, relato pessoal e redes.
4. Clique em **Gerar conteúdo**. O sistema informa os dados que faltam.
5. Confira as artes e as legendas. Baixe PNGs individuais ou o pacote ZIP.
6. Marque a conferência e clique em **Confirmar revisão**.
7. Publique manualmente e confirme cada rede no item. É possível registrar todas as redes pendentes de uma vez após marcar a confirmação explícita.

O ZIP inclui PNGs em ordem, legendas, texto alternativo, prompt de IA e snapshot dos dados. Para YouTube, há também exportação separada em MP4.

## Vídeo pronto para Shorts

Na prévia diária ou no conteúdo gerado do Calendário, ajuste **Segundos por página** (padrão: 8; intervalo: 3 a 20) e clique em **Baixar vídeo MP4**. Todas as páginas viram um único vídeo vertical 1080 × 1920, H.264, 30 quadros por segundo, na ordem do carrossel. Uma arte diária vira uma página fixa durante o tempo escolhido. O limite total é de 180 segundos.

O vídeo usa sempre o layout Shorts, enquanto PNG/ZIP usam o formato fixo de Instagram/Threads. A exportação acontece no navegador e mostra o progresso; mantenha a aba aberta até terminar. Se o navegador não oferecer o codificador necessário, o sistema informa o problema e orienta tentar Chrome ou Edge atualizado no computador.

O arquivo sai sem áudio, música ou narração. Envie o MP4 ao YouTube e use o título/descrição fornecidos pelo sistema; adicione áudio lá se desejar. Exportar não confirma a postagem, não modifica o snapshot e não publica automaticamente. Esta função usa as artes do sistema; não importa imagens externas de IA.

## Imagens para Instagram / Threads

As prévias, PNGs, ZIPs e prompts de imagem usam sempre 1080 × 1350 (4:5), inclusive nas versões arquivadas. Não há seletor de formato: para YouTube, use **Baixar vídeo MP4**, que monta as páginas em 1080 × 1920 (9:16).

## Rotina

| Dia     | Conteúdo complementar   | Dados necessários                                   |
| ------- | ----------------------- | --------------------------------------------------- |
| Segunda | Dificuldade da semana   | Compras, cotação e observação pessoal               |
| Terça   | Educação Bitcoin        | Tema da sequência editorial; observação opcional    |
| Quarta  | Taxa sem esconder       | Compras e cotação salvas                            |
| Quinta  | Quanto R$ 10 compraram? | Compras agrupadas por dia, normalizadas pelo aporte |
| Sexta   | Radar Cripto da Semana  | Fontes, datas, fato, contexto, comentário e revisão |
| Sábado  | Resumo semanal          | Compras e cotação salvas                            |
| Domingo | Reflexão visual         | Dados e texto pessoal                               |

As compras diárias têm cartões próprios. O conteúdo complementar financeiro usa os sete dias encerrados na véspera, limitado ao início do desafio. No primeiro dia, usa o próprio dia. O Radar tradicional cobre sábado a sexta. O novo pacote pesquisado pelo Codex cobre segunda a sexta, até o horário efetivo da pesquisa.

Os mensais são distribuídos a partir do dia escolhido do mês seguinte: fechamento, comparação, ranking, médias, evolução, aprendizados, dificuldade, balanço/próximo foco e taxas. No fim do mês, itens que ultrapassariam a última data ficam nesse último dia; podem ser reagendados individualmente. O mês inicial do desafio cobre apenas o período desde 09/09/2026.

**Hoje**, **Próximos 7 dias** e **Atrasados** buscam também fora do mês selecionado. Os demais filtros e a grade trabalham no mês escolhido. Agenda ICS e relatório CSV exportam os itens carregados. O CSV não altera a publicação.

## Datas, números e versões

- Todos os dias são interpretados em Brasília. A hora mostrada da cotação é a coleta real.
- Mensais exigem a cotação de fechamento da última data do mês anterior. Não se substitui um fechamento ausente pela cotação atual.
- Diário exige uma compra na data. Compras após o corte da cotação não entram; o aviso fica na versão.
- Aportes, BTC líquido, taxas e resultado são calculados separadamente com precisão decimal. A taxa em reais é aproximada ao preço da execução.
- O ranking agrega compras do mesmo dia e compara satoshis líquidos por R$ 10 aportados.
- Gráficos mostram pontos efetivamente registrados, sem preencher lacunas. Resultado indisponível por falta de abertura aparece como tal.
- Gerar novamente ou editar os textos cria outra versão. Números de versões arquivadas não são recalculados.
- A arte diária preserva o modelo financeiro fixo. Os carrosséis complementares permitem editar os textos numa opção avançada; a edição exige nova revisão.
- Alterar título, relato ou notícias retira a versão atual do fluxo de revisão; as versões anteriores continuam disponíveis.
- Cada confirmação mantém a versão publicada, hora, canal, URL opcional, observação e proprietário. Gerar outra versão não troca a referência de uma postagem antiga.
- **Desfazer confirmação** remove a marcação atual e preserva seus detalhes no histórico.
- Atualizações simultâneas usam controle de revisão: a aba desatualizada precisa reabrir o item.

## Pausar, substituir e reagendar

Altere a data e o prazo para adiar. Use **Pausado** para suspender um item. **Cancelado** exige motivo. Marcos aparecem como extras, permitindo decidir a colisão: mantenha ambos, adie um ou registre na observação que o conteúdo foi combinado e cancele o substituído. A aplicação não combina textos nem marca outra postagem como feita por inferência.

## Radar e IA

O agendamento no Codex pesquisa quatro notícias toda sexta às 18h e entrega um arquivo JSON com um carrossel independente por notícia. Importe em **Calendário → Importar Radar preparado pelo Codex** e revise os conteúdos. Consulte [RADAR-CODEX.md](RADAR-CODEX.md) para o contrato do arquivo e as regras editoriais. A coleta RSS automática foi desativada; o formulário tradicional continua disponível para uso manual e histórico.

No item, use **Copiar prompt de pesquisa** em uma ferramenta com busca na web. O prompt pede o período e um arquivo JSON compatível. Importe a pesquisa e confira os campos visuais de cada notícia. Importações sempre entram sem revisão. Também é possível cadastrar notícias manualmente. Selecione até cinco; todas precisam ter fato, contexto, comentário e conferência antes da geração.

As páginas distinguem notícia de análise/inferência e levam as URLs. O envio às redes pelo Buffer exige revisão e autorização explícita dos materiais. Sem fatos relevantes, cancele o Radar com esse motivo, sem transformar falha de coleta em afirmação de que não houve notícias.

**Copiar prompt para IA** permite criar uma variação visual fora do sistema, inclusive a reflexão de domingo. Não é necessário contratar uma API para usar os templates PNG. O sistema não chama uma API de IA nem importa imagens externas para o arquivo de versões. A pesquisa semanal é executada pelo agendamento do Codex e o usuário importa o JSON resultante. O arquivo baixado pelo sistema reproduz sua própria arte programática.

## Marcos

São analisados após alterações em compras/consultas manuais, na manutenção diária e pelo botão **Analisar marcos agora**. Os alvos padrão podem ser complementados com metas personalizadas.

| Métrica                 | Regra                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Dias de desafio         | Dias corridos desde 09/09/2026                                                                                     |
| Dias com compra         | Datas distintas, independentemente do número de ordens                                                             |
| Sequência               | Dias consecutivos com compra                                                                                       |
| Aportes                 | Soma do dinheiro aportado, sem valorização                                                                         |
| BTC                     | Satoshis líquidos, depois da taxa                                                                                  |
| Carteira                | Primeira passagem pelo alvo com cotação salva e compras até o corte                                                |
| Primeiro mês positivo   | Mês completo com abertura e fechamento válidos; variação descontando aportes                                       |
| Recuperação             | Primeiro resultado acumulado não negativo após um resultado negativo registrado                                    |
| Melhor semana           | Novo recorde do resultado semanal em reais, descontando aportes; semanas sábado–sexta, após uma semana-base válida |
| Maior taxa proporcional | Novo recorde de taxa ao preço da execução dividido pelo aporte; a primeira compra é a referência                   |
| Primeiro mês completo   | Primeiro mês civil inteiro com compra em todas as datas; o mês inicial parcial não conta                           |

Cada ocorrência guarda compras de referência, valor, data e cotação quando aplicável. A chave impede repetição; recordes semanais e de taxa podem ter novas ocorrências. Oscilações não apagam conquistas. Correções que mudem a ocorrência original são sinalizadas para conferência; não há apagamento automático de posts ou eventos.

## Agendamento e backup

O terceiro cron, `0 * * * *`, consulta os envios do Buffer a cada hora e faz manutenção diária às 18h de Brasília: mantém o horizonte de meses configurado, analisa marcos. Os dois crons de cotação continuam. O horário real e as falhas são registrados; uma falha pode ser tratada pelos botões do painel. Não há promessa de execução pontual ou de disponibilidade das fontes.

O backup JSON passa a `version: 2`, mantendo os dados antigos e adicionando calendário, versões, publicações, histórico, configurações, marcos, notícias e execuções. Não inclui senhas. A restauração continua administrativa e assistida.

As publicações arquivadas antes desta atualização permanecem em **Publicações**. Elas não são vinculadas automaticamente a cartões, pois não há como inferir com segurança a equivalência entre os conteúdos.

## Publicação pelo Buffer

Instagram, Threads e TikTok são as redes padrão dos novos cartões. O histórico e a confirmação manual do YouTube continuam disponíveis. Configure a integração conforme [DEPLOY-BUFFER.md](DEPLOY-BUFFER.md).

No conteúdo revisado, prepare os arquivos, confira as prévias, as legendas, os perfis e o horário e autorize o envio. Instagram e Threads recebem as imagens; TikTok recebe um MP4 vertical. Agendamentos aparecem em Publicações e só viram publicados após confirmação da API. Envios ativos impedem alterações nos materiais; cancele o agendamento antes de refazer a versão.

O backup inclui os registros e referências da integração, mas não a chave da API nem os arquivos binários do R2.
