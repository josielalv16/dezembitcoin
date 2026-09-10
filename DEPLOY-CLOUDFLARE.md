# Publicação pelo GitHub no Cloudflare Workers

As telas enviadas são de **Workers Builds**, não Cloudflare Pages. O projeto foi preparado para esse fluxo. Não é necessário informar uma chave da Bitpreço.

## 1. Crie o banco antes de implantar

No painel Cloudflare, abra **Storage & Databases → D1 → Create database** (em português, Armazenamento e bancos de dados → D1).

- Nome: `dezembitcoin`.
- Após criar, copie o **Database ID** (UUID).
- Não precisa criar as tabelas manualmente: o comando de implantação executa as migrations.

O Database ID identifica o banco, não é senha. Não crie outro banco a cada implantação.

## 2. Configure a tela de criação do projeto

Selecione o repositório `josielalv16/dezembitcoin` e a branch `main`.

| Campo da tela                                 | Valor                                     |
| --------------------------------------------- | ----------------------------------------- |
| Nome do projeto                               | `dezembitcoin`                            |
| Comando da build                              | `npm run build`                           |
| Comando de implantação                        | `npm run deploy`                          |
| Compilações para ramificações de não produção | **Desmarcar** nesta primeira versão       |
| Caminho, nas configurações avançadas          | `/`                                       |
| Token de API                                  | Criar novo token, pelo próprio Cloudflare |
| Nome do token, se solicitado                  | `dezembitcoin-build`                      |
| Protect with Cloudflare Access                | Opcional; a aplicação já exige senha      |

Deixe o Cloudflare instalar as dependências pelo `package-lock.json`. Não use o comando padrão `npx wrangler deploy` diretamente: o script `npm run deploy` configura o ID do banco e aplica as tabelas antes da publicação.

Em **variáveis de build**, adicione:

| Nome             | Valor                    |
| ---------------- | ------------------------ |
| `D1_DATABASE_ID` | UUID copiado do banco D1 |
| `NODE_VERSION`   | `22`                     |

Essas variáveis pertencem ao ambiente de **build**, não às variáveis da aplicação em execução. Não coloque a senha privada nessa lista.

O token usado pela build precisa poder publicar Workers e aplicar migrations D1 na mesma conta: permissões **Account → Workers Scripts → Edit** e **Account → D1 → Edit**, além das permissões de build que o Cloudflare solicitar para a integração. Se o token automático não incluir D1, ajuste/substitua o token de build no painel. Não cole tokens em chats nem no GitHub.

Clique em **Implantar**. No log, a sequência esperada é: instalação → build → migrations D1 → publicação do Worker e assets. Se faltar `D1_DATABASE_ID`, a implantação para com uma mensagem específica, sem publicar com o banco errado.

## 3. Configure a senha privada

Depois da primeira implantação:

**Workers & Pages → dezembitcoin → Settings → Variables and Secrets → Add**.

- Tipo: **Secret**.
- Nome: `ADMIN_PASSWORD`.
- Valor: uma senha exclusiva de pelo menos 16 caracteres, escolhida por você.
- Salve e aplique/implante a alteração conforme o painel solicitar.

Sem esse segredo, o sistema recusa o login. A senha é usada só no servidor e não entra na build do navegador. A troca da senha invalida as sessões existentes. Não reutilize senha de corretora.

O **token de API da build** e **ADMIN_PASSWORD** têm funções diferentes: o primeiro publica o código; o segundo permite entrar no diário.

## 4. Confira os vínculos e agendamentos

Na página do Worker:

- **Bindings:** deve existir `DB`, tipo D1, apontando para `dezembitcoin`.
- **Settings → Trigger Events / Cron Triggers:** devem aparecer `0,5,10 15 * * *`, `55,57,59 2 * * *` e `0 21 * * *`.
- As expressões são UTC. Correspondem a meio-dia e 23h55 de Brasília, com novas tentativas se a primeira falhar.
- Mudanças de cron podem levar alguns minutos para propagar. O horário de execução não é uma garantia absoluta; o post sempre informa a coleta real.

Não adicione cron manual duplicado: a configuração já está versionada em `wrangler.jsonc`.

O terceiro cron faz a manutenção editorial às 18h de Brasília e coleta candidatos do Radar às sextas. A migration `0002_editorial.sql` adiciona as tabelas sem apagar compras, cotações ou arquivos antigos. Para atualizar a instalação existente, mantenha **build: `npm run build`** e **deploy: `npm run deploy`**, o mesmo D1_DATABASE_ID e ADMIN_PASSWORD. Não há nova variável obrigatória. Após o deploy, abra **Calendário → Gerar calendário** e confira **Marcos**. Guia: [GUIA-EDITORIAL.md](GUIA-EDITORIAL.md).

## 5. Primeiro acesso

1. Abra o endereço `workers.dev` mostrado pelo Cloudflare.
2. Entre com a senha configurada.
3. Em **Compras**, cadastre os dados do extrato e o **aporte pago**, que é separado do total líquido.
4. Confira o saldo líquido calculado.
5. Em **Cotações**, clique em **Consultar agora**.
6. Em **Criar conteúdo**, escolha diário, data e cotação; clique em **Preparar conteúdo**.
7. Confira a arte, baixe o PNG e copie as legendas.
8. Clique em **Arquivar versão** para congelar os números. Em Publicações, marque as redes depois de publicar.
9. Exporte um backup.

O banco começa vazio. Cadastrar uma compra antiga não recupera sua cotação histórica; o sistema só pode avaliar uma data para a qual existe cotação salva.

## Atualizações pelo GitHub

Commits na `main` disparam uma nova build. Migrations já aplicadas são reconhecidas e não repetidas. O banco persistente não é apagado pelo deploy. Não habilite previews com o banco de produção; uma futura homologação precisa de outro banco e configuração própria.

## Diagnóstico rápido

| Situação                                 | Conferir                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Erro `D1_DATABASE_ID`                    | Variável de build e UUID correto                                 |
| Erro de autorização ao aplicar migration | Token da build com D1 Edit na conta do banco                     |
| `no such table` ou erro de banco         | Uso de `npm run deploy`, execução das migrations e vínculo DB    |
| Pedido para configurar ADMIN_PASSWORD    | Secret de runtime, 16 caracteres ou mais, alteração implantada   |
| Muitas tentativas de login               | Aguardar a janela de 15 minutos                                  |
| Cotação falhou                           | Aba Cotações e logs do Worker; tentar manualmente depois         |
| Não há cotação em data antiga            | Captura não existia; o ticker atual não recupera aquele instante |

Referências oficiais: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [migrations D1](https://developers.cloudflare.com/d1/reference/migrations/), [cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

Para habilitar Instagram, Threads e TikTok com aprovação e agendamento, siga [Configuração do Buffer e R2](DEPLOY-BUFFER.md). Sem R2_BUCKET_NAME na build, o deploy continua funcionando com a integração desabilitada.
