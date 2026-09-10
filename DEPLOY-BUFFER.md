# Ativar publicações pelo Buffer

O sistema prepara PNGs para Instagram/Threads e MP4 vertical para TikTok. Você revisa a versão, confere os materiais e autoriza o envio. YouTube continua disponível como exportação manual e histórico, mas não participa da integração.

## 1. Criar a chave do Buffer

Na conta Buffer que já tem os três perfis, abra [API settings](https://publish.buffer.com/settings/api) e crie uma **API key** pessoal. Se o painel pedir permissões, permita leitura da conta/canais e leitura/escrita de posts. Não cole a chave no chat, no GitHub ou em variáveis VITE_.

No Cloudflare: **Workers & Pages → dezembitcoin → Settings → Variables and Secrets → Add**:

| Campo | Valor |
| --- | --- |
| Tipo | Secret |
| Nome | `BUFFER_API_KEY` |
| Valor | A chave criada no Buffer |

Salve/implante a alteração. Este segredo pertence ao Worker em execução, **não** às variáveis de build. O sistema nunca mostra nem devolve a chave ao navegador. O Wrangler preserva os segredos nos próximos deploys.

## 2. Criar o armazenamento dos materiais

No Cloudflare: **R2 object storage → Create bucket**. Crie `dezembitcoin-media`, usando armazenamento Standard. Se R2 ainda não estiver ativado, conclua a ativação apresentada pelo Cloudflare. Não é necessário habilitar acesso público do bucket, domínio próprio, CORS ou criar token S3.

No bucket, em **Settings → Object lifecycle rules**, configure uma regra para **excluir todos os objetos após 90 dias**. Use este bucket exclusivamente para os materiais de publicação do projeto. O sistema preserva os dados das versões no D1; o R2 guarda somente as mídias destinadas às redes. O backup JSON não contém os arquivos binários do R2.

No Worker, em **Settings → Build → Variables and secrets** (as variáveis da build), acrescente:

| Nome | Valor |
| --- | --- |
| `R2_BUCKET_NAME` | `dezembitcoin-media` |

Mantenha `D1_DATABASE_ID` e o comando `npm run deploy`. Execute uma nova build/implantação após configurar a variável. O script cria automaticamente o vínculo **MEDIA** com esse bucket e aplica `0003_buffer.sql`. Se o token de build não conseguir associar o bucket, confira a permissão de R2 na mesma conta Cloudflare, além de Workers Scripts e D1 já utilizadas.

Sem `R2_BUCKET_NAME`, o deploy continua funcionando para os recursos anteriores, mas o envio de mídias informa que falta armazenamento. Não crie o vínculo apenas pelo painel: o próximo deploy usa a configuração gerada pelo script.

## 3. Escolher os perfis no sistema

1. Abra **Buffer** no menu do Dez em Bitcoin.
2. Confira se chave e armazenamento aparecem como configurados.
3. Clique em **Buscar perfis conectados**.
4. Escolha o perfil correto de Instagram, Threads e TikTok e clique em **Salvar perfis selecionados**.

Caso um perfil esteja desconectado, bloqueado ou com a fila pausada, resolva no Buffer. O tipo da conta e suas permissões precisam permitir publicação automática, e não somente lembretes. A resposta do Buffer será apresentada se alguma configuração do perfil impedir o envio.

## 4. Gerar, aprovar e enviar

1. Abra o conteúdo pelo **Calendário** ou **Publicações**.
2. Gere a versão e faça a revisão usual.
3. Em **Publicação pelo Buffer**, selecione as redes e ajuste as legendas.
4. Escolha **Agendar horário** (horário de Brasília, entre 2 minutos e 30 dias) ou **Publicar agora**.
5. Para TikTok, escolha o tempo por página. Se aplicável, marque a declaração de conteúdo gerado por IA.
6. Clique em **Preparar envio ao Buffer**. Confira os PNGs e reproduza o vídeo na prévia.
7. Marque a autorização e clique em **Aprovar e enviar ao Buffer**. Mantenha a aba aberta até terminar.

Os arquivos só são enviados ao armazenamento depois dessa autorização. O vídeo é gerado no seu navegador, sem áudio. Instagram/Threads recebem as imagens na ordem; TikTok recebe um vídeo com todas as páginas. Nesta versão o limite é de dez imagens, 5 MB por PNG e 32 MB por MP4. Não há importação de músicas ou efeitos dos aplicativos.

Depois que o Buffer aceitar o agendamento, o computador pode ser desligado. O status **Agendado** não significa **Publicado**. O sistema consulta o Buffer a cada hora, até três registros elegíveis por execução, e só registra a publicação por rede após o retorno `sent` com data. A opção **Atualizar status** respeita o intervalo de consulta e a data agendada; filas maiores podem levar mais de uma execução para serem atualizadas.

## Falhas, alterações e cancelamentos

- Uma recusa explícita do Buffer fica como **Envio recusado**, permitindo corrigir e aprovar outra tentativa.
- Se a conexão cair sem confirmar o resultado, o registro fica como **Resultado incerto**. Não há repetição automática. Use **Resolver resultado incerto** para informar o ID encontrado no Buffer ou confirmar que verificou a fila e os publicados e que o post não existe.
- Os envios são independentes por rede. Se a segunda rede falhar depois de a primeira aceitar, o primeiro envio permanece registrado; reabra o conteúdo e confira antes de continuar.
- Itens com envio ativo ficam protegidos contra alteração dos materiais. Para mudar um agendamento, marque a confirmação e use **Cancelar agendamento**, depois prepare/aprove a nova versão. Não excluímos posts já publicados.
- Se cancelar diretamente no Buffer, confira a atualização no sistema; uma resposta de exclusão ausente pode exigir conferência manual. O registro e o ID permanecem disponíveis para diagnóstico.
- Se os três perfis estiverem na conta gratuita, os limites de fila e de API continuam valendo. O sistema não contorna esses limites nem garante disponibilidade permanente da API.

Os URLs individuais das mídias precisam ser acessíveis pelo Buffer sem login, e por isso usam identificadores aleatórios e expiram após 90 dias. Apenas esses arquivos são públicos por URL; o diário, as legendas editáveis, as compras e os endpoints de configuração continuam protegidos. Se houver Cloudflare Access protegendo o domínio inteiro, permita acesso externo somente ao caminho `/api/buffer/media/*`, mantendo as outras rotas protegidas.

## Referências e verificação

- [API Buffer: autenticação](https://developers.buffer.com/guides/authentication.html)
- [API Buffer: posts e agendamento](https://developers.buffer.com/guides/posts-and-scheduling.html)
- [API Buffer: formatos e campos por rede](https://developers.buffer.com/reference.html)
- [Cloudflare: segredos](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare: ciclo de vida R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)

Os testes locais usam API Buffer simulada; não publicam em perfis reais. A validação final com a sua conta depende de configurar a chave, o bucket e os perfis, e de você aprovar o primeiro conteúdo real.
