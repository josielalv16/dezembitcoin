# Validação

## Publicações integradas ao Calendário — 10/09/2026

- Build e 35 testes existentes aprovados. Consulta do arquivo editorial inclui itens com versões ou confirmações, independentemente do mês planejado.
- Navegador com D1 local: três conteúdos do Calendário apareceram em Publicações; abertura de conteúdo com exportação MP4 disponível; ausência de Criar conteúdo no menu confirmada. Arquivo anterior preservado.
- Sem alteração ou migração de dados de produção.

## Exportação MP4 — 10/09/2026

- Build TypeScript/Vite e 35 testes existentes aprovados. O codificador é carregado sob demanda, apenas ao pedir vídeo.
- Playwright em navegador local: download real do MP4 de uma arte diária e de um carrossel com seis páginas, ambos com 3 segundos por página.
- Reprodução do carrossel no elemento de vídeo do navegador, dimensões 1080 × 1920, duração de 18 segundos e busca até 16 segundos aprovadas. Última página conferida visualmente.
- Sem postagem no YouTube nem verificação de implantação remota. Dados usados exclusivamente de teste local; exportação sem áudio e dependente de suporte do navegador ao codificador H.264.

## Formato YouTube / Shorts — 10/09/2026

- Build TypeScript/Vite aprovado e os 35 testes existentes passaram.
- Navegador local: seleção de formato e download de uma arte diária arquivada e de um carrossel de seis páginas, nos formatos feed e Shorts.
- Cabeçalhos dos PNGs conferidos: 1080 × 1350 no feed e 1080 × 1920 em Shorts, inclusive todas as páginas dos ZIPs. Conferência visual da arte diária e da capa do carrossel vertical.
- `formato.json` e prompt exportado correspondem ao formato escolhido. O `snapshot.json` é idêntico entre as duas exportações, preservando os dados congelados.
- Dados de teste exclusivamente locais. A implantação remota e o enquadramento aplicado pelo editor de vídeo não foram verificados.

## Evolução editorial — 09/09/2026

- 35 testes unitários: conjunto financeiro anterior, calendário a partir do início do desafio, fevereiro bissexto, chaves estáveis, Radar sábado–sexta, bloqueio de fechamento ausente, compra após cotação, relatos obrigatórios, preparação educativa antecipada, estados por rede, precisão de snapshots, URLs, dias corridos/compras/sequência, primeira passagem da carteira, BTC líquido, recuperação, mês positivo descontando aportes e exclusão do mês inicial parcial.
- `scripts/smoke-editorial.mjs` passou contra Wrangler/D1 local: geração repetida de 12 meses sem duplicação, bloqueio antes de revisão, duas confirmações concorrentes (uma aceita e outra 409), estados parcial/completo, desfazer com auditoria, versões anteriores intactas, bloqueio de notícias futuras, marcos sem duplicação, geração da arte do marco e backup versão 2.
- `scripts/smoke-local.mjs` passou novamente, incluindo consulta real à Bitpreço, CRUD, autenticação, origem das alterações e arquivo financeiro anterior.
- Migration `0002_editorial.sql` aplicada localmente. TypeScript navegador/Worker, build Vite e `wrangler deploy --dry-run` aprovados.
- Navegador: calendário desktop (1500 × 1000) e celular (390 × 844), abertura de conteúdo, geração de comparação, preview das páginas, download ZIP, revisão e formulário de notícias. Coleta RSS real retornou candidatos do período; seu cadastro permanece sem aprovação editorial automática.
- Cron de manutenção chamado pelo endpoint de teste local; verificação remota depende da build/implantação na conta Cloudflare.
- `npm audit --omit=dev` não apontou vulnerabilidades nas dependências de produção na verificação.

Os dados criados pelos scripts são fixtures exclusivamente locais. Esta verificação não confirma a execução futura de cron no Cloudflare, a disponibilidade permanente dos RSS ou a veracidade dos fatos de uma notícia. A revisão de conteúdo continua necessária. As integrações de IA são via prompt/importação, conforme GUIA-EDITORIAL.md.

## Primeira versão

Verificado localmente em 09/09/2026, com Node 24, Wrangler e D1 local. Nenhuma base remota foi criada ou alterada durante a implementação.

- 15 testes automatizados aprovados: cálculo financeiro, taxa única, período sem cotação inicial, compra após o fechamento anterior, dias sem compra, datas de Brasília, validação numérica, preservação de referência histórica, captura idempotente, falha do provedor, autenticação obrigatória e origem das alterações.
- TypeScript do navegador e do Worker aprovado; build Vite concluído; `wrangler deploy --dry-run` concluído com os bindings DB e ASSETS.
- Migration aplicada no D1 local.
- Teste HTTP integrado aprovado: login, acesso negado sem sessão, rejeição de origem externa, cadastro, duplicata, campos inválidos, consulta real à Bitpreço, resumo, arquivamento, edição sem alteração da versão histórica, status de publicação e exportação de backup.
- Navegador: login, compra com vírgula decimal, confirmação do saldo líquido, painel, geração e download dos três formatos de PNG, arquivamento. Conferência visual em 1440 × 1000 e 390 × 844.

Limites: o cron foi validado em código e no empacotamento, mas sua execução no Cloudflare depende da implantação. O vínculo D1, permissões do token de build, senha e agendamentos reais precisam ser conferidos no painel seguindo DEPLOY-CLOUDFLARE.md. O banco de produção começa vazio. O visual das artes é um template programático baseado na identidade aprovada.

## Integração Buffer

- Testes automatizados cobrem aprovação, perfil autorizado, versão atual, concorrência, falha de rede sem reenvio, cancelamento, resposta atrasada e confirmação por rede. Utilizam SQLite com as migrations reais e API Buffer simulada.
- Navegador: aprovação desmarcada por padrão, prévias de seis PNGs e MP4 vertical, upload de sete arquivos ao R2 local e três envios simulados. Nenhuma publicação real realizada.
- HTTP: mídia MP4 com Range retornou 206; endpoints privados sem autenticação retornaram 401.
- A conexão e a publicação reais dependem de configurar BUFFER_API_KEY, R2 e os perfis e de aprovar um conteúdo na conta do usuário.
