# Validação da primeira versão

Verificado localmente em 09/09/2026, com Node 24, Wrangler e D1 local. Nenhuma base remota foi criada ou alterada durante a implementação.

- 15 testes automatizados aprovados: cálculo financeiro, taxa única, período sem cotação inicial, compra após o fechamento anterior, dias sem compra, datas de Brasília, validação numérica, preservação de referência histórica, captura idempotente, falha do provedor, autenticação obrigatória e origem das alterações.
- TypeScript do navegador e do Worker aprovado; build Vite concluído; `wrangler deploy --dry-run` concluído com os bindings DB e ASSETS.
- Migration aplicada no D1 local.
- Teste HTTP integrado aprovado: login, acesso negado sem sessão, rejeição de origem externa, cadastro, duplicata, campos inválidos, consulta real à Bitpreço, resumo, arquivamento, edição sem alteração da versão histórica, status de publicação e exportação de backup.
- Navegador: login, compra com vírgula decimal, confirmação do saldo líquido, painel, geração e download dos três formatos de PNG, arquivamento. Conferência visual em 1440 × 1000 e 390 × 844.

Limites: o cron foi validado em código e no empacotamento, mas sua execução no Cloudflare depende da implantação. O vínculo D1, permissões do token de build, senha e agendamentos reais precisam ser conferidos no painel seguindo DEPLOY-CLOUDFLARE.md. O banco de produção começa vazio. O visual das artes é um template programático baseado na identidade aprovada.
