# Dez em Bitcoin

Diário privado de compras de Bitcoin, com histórico de cotações, resumos, artes PNG e legendas. Aplicação TypeScript para **Cloudflare Workers + D1**, com frontend Vite e exportação de imagens no navegador. Não precisa de serviço de IA nem de renderização paga.

## Primeira versão

- Cadastro, edição e exclusão de compras; ID de operação único; valores em reais e BTC com validação.
- Aporte real separado do total líquido exibido pela corretora; BTC armazenado em satoshis inteiros.
- Consultas Bitpreço (`last`) manuais e automáticas às 12h e 23h55 de Brasília, com duas novas tentativas.
- Painel, evolução por fechamentos, marcos informativos e histórico de coletas.
- Conteúdo diário, semanal e mensal, PNG 1080 × 1350 inspirado no modelo aprovado, legendas Instagram/Threads e título/descrição YouTube/Shorts.
- Arquivo de versões com dados congelados e marcação das redes onde foram publicadas.
- Exportação JSON do histórico e cópia de dados para preparar conteúdo fora da aplicação.
- Senha privada, sessão HttpOnly, limitação de tentativas e validação de origem nas alterações.

**Não faz compras, vendas ou publicações nas redes.** Não tem importação automática de extratos, restauração pela interface, página pública, vídeo ou carrossel multipágina nesta versão. As observações e IDs não saem no botão de copiar dados públicos; o backup completo contém essas informações e deve permanecer privado.

## Desenvolvimento

Requer Node.js 22 ou superior e npm recente. Use Node 22 LTS ou 24 LTS; Node 12 não é compatível.

```sh
npm ci
```

Copie `.dev.vars.example` para `.dev.vars` e substitua a senha de exemplo por uma senha local de pelo menos 16 caracteres. Esse arquivo é ignorado pelo Git. Então:

```sh
npm run dev
```

Abra o endereço exibido pelo Wrangler (normalmente http://localhost:8787). O banco local é independente da produção, dentro de `.wrangler/`. O frontend precisa de novo `npm run build` após alterações de tela; o Worker recarrega em desenvolvimento.

```sh
npm run check
```

Executa testes financeiros, TypeScript, build e empacotamento de teste do Worker. Não publica nem acessa o banco remoto.

Para testar o fluxo integrado, com o Wrangler local já rodando, defina `TEST_PASSWORD` com a senha local e execute `node scripts/smoke-local.mjs`. O script só acessa `127.0.0.1:8787`, cria e remove uma compra de teste e deixa uma versão de conteúdo de teste no arquivo local. Não execute apontando para produção. Ele verifica autenticação, origem das alterações, duplicatas, validação, cotação, imutabilidade das versões e backup.

## Publicar no Cloudflare

Veja **[DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md)**. O script de implantação aplica as migrations pendentes e depois publica Worker e frontend. Não usa banco remoto em desenvolvimento.

## Regras financeiras

Início do desafio: **09/09/2026**. O número do dia é a distância em dias corridos dessa data, independente do número de compras. Os horários de negócio são de Brasília (UTC−3, `America/Sao_Paulo`).

- `Quantidade` do extrato = BTC bruto; `Taxa` = BTC descontado; saldo líquido = bruto − taxa.
- `Aporte pago` = dinheiro desembolsado incluindo taxas. Não substituir pelo `Total do extrato`.
- Valor estimado = satoshis líquidos acumulados ÷ 100.000.000 × preço `last`.
- Resultado acumulado = valor estimado − aportes; percentual = resultado ÷ aportes × 100.
- Taxas aproximadas em reais = taxas BTC × preço das respectivas execuções.
- Valores calculados com Decimal, arredondados só para apresentação. O percentual pode não coincidir com a divisão de valores em reais já arredondados.
- Resultado do período desconta aportes do período e usa o fechamento do dia anterior. Sem referência inicial válida, aparece indisponível.
- Todo conteúdo usa compras efetivamente registradas até o horário real da cotação selecionada. Compras posteriores ficam de fora com aviso. Cadastros retroativos afetam novos cálculos, nunca uma versão arquivada.
- Cotações históricas não são inventadas. Sem captura naquele dia, não há como gerar uma avaliação para aquela data a partir do ticker atual. Este endpoint não é um histórico de preços.
- `timestamp` do provedor é preservado como texto, sem presumir fuso; o horário mostrado no post é o instante da consulta convertido para Brasília.
- A cotação `last` é referência do último negócio do provedor, não garantia de liquidação na Bitybank. Não se descontam custos futuros de venda.

## Coletas e falhas

O agendador usa UTC: `0,5,10 15 * * *` (12h, 12h05, 12h10) e `55,57,59 2 * * *` (23h55, 23h57, 23h59 de Brasília do dia anterior em UTC). Cada janela tenta uma coleta; se já existir uma captura do mesmo tipo no dia, não consulta novamente. O banco impede duplicatas mesmo em execuções concorrentes. A captura guarda o horário efetivo, inclusive em caso de atraso. Uma execução que atravessa a data não é usada para preencher o dia anterior.

Falhas aparecem na aba Cotações; não há e-mail automático nesta versão. A indisponibilidade prolongada do serviço ou da API pode deixar lacunas. A interface nunca disfarça uma cotação manual atual como captura antiga. Os últimos 90 dias de tentativas são mantidos; compras, cotações e versões não expiram.

## Backup e privacidade

Use **Exportar backup** periodicamente e guarde o JSON fora do serviço. Inclui compras, cotações e versões completas, com `version: 1`. A restauração exige importação administrativa assistida nesta versão. Para uma cópia nativa adicional do banco, use o export SQL do D1 no painel/CLI. Não publique backups, senhas, `.dev.vars` ou dumps em repositórios.

A aplicação inicia vazia em produção. Os exemplos financeiros nos testes são apenas casos de validação; não são inseridos no banco. Senhas são configuradas diretamente no Cloudflare pelo proprietário. Nenhuma credencial de corretora é necessária.

## Limites da primeira versão

Voltada a um único usuário e ao histórico de compras do desafio. Não modela venda, saque, transferência com taxa, cashback ou saldo anterior. Havendo essas operações, o livro financeiro precisa ser estendido antes de tratá-las como compras. As imagens são templates programáticos consistentes, não reproduções pixel a pixel da ilustração gerada por IA. O dashboard mostra avaliação indicativa com a última cotação disponível; os conteúdos usam corte histórico estrito.
