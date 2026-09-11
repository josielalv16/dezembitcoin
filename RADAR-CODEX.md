# Radar Cripto da Semana — pesquisa e importação

Toda sexta-feira às 18h (America/Sao_Paulo), o agendamento do Codex pesquisa acontecimentos desde segunda-feira até o instante da pesquisa na sexta. Não inclui notícias futuras nem o fim de semana ainda não ocorrido. O resultado é um JSON com quatro notícias diferentes, cada uma com carrossel independente. Se faltarem notícias verificáveis, entregar de uma a três com justificativa; nunca inventar para completar quatro. Se nenhuma for verificável, informar o impedimento e não gerar um pacote vazio.

## Pesquisa e edição

- Abrir e ler as fontes, não usar apenas manchetes, RSS ou snippets. Priorizar fontes primárias: comunicados oficiais, documentos de reguladores, projetos e empresas. Complementar com jornalismo confiável; alegações importantes ou controversas precisam de confirmação independente. Não tratar propaganda ou alegações da própria empresa como fatos comprovados.
- Escolher notícias relevantes e diversas sobre Bitcoin, Ethereum, adoção, tecnologia, regulação, segurança e mercado. Não repetir o mesmo acontecimento em vários carrosséis. Separar data do acontecimento de data da matéria. Um anúncio desta semana sobre um evento futuro deve ser descrito como anúncio, com a data do anúncio como eventDate.
- Escrever em português brasileiro, com palavras próprias e linguagem simples. Explicar termos na primeira ocorrência. Preservar ressalvas, valores, datas e significado; não copiar trechos extensos das fontes nem fazer paráfrase frase a frase. Não prometer valorização nem recomendar compra/venda.
- Cada carrossel tem 4 a 8 páginas (preferência por 5 ou 6): capa informativa; o que aconteceu; contexto; exemplo hipotético quando ajudar; análise ou inferência claramente identificada; fechamento/fontes se necessário. Não adicionar páginas vazias ou frases genéricas para aumentar a quantidade.
- Distinguir fatos de opinião. Exemplos inventados devem dizer que são hipotéticos. Sem perguntas para engajamento, pedidos de comentários, bastidores do sistema ou necessidade de o usuário aparecer.
- A fonte principal deve ser uma URL canônica e estável, pois ela identifica a notícia na reimportação. Cada página referencia as fontes que a sustentam por índices. As artes exibem nome/data das fontes; o sistema guarda e mostra os links completos no painel de pesquisa. Incluir links relevantes nas legendas quando couber, principalmente no Threads, sem exceder limites.

## Arquivo obrigatório

Salvar em `output/radar/radar-AAAA-MM-DD.json`, usando a data da sexta. UTF-8, JSON puro sem cercas Markdown, até 60.000 bytes. Não sobrescrever arquivo anterior diferente: usar um sufixo de versão e informar a mudança. Exatamente os campos abaixo (o sistema rejeita campos desconhecidos):

```json
{
  "format": "dezembitcoin.radar",
  "version": 1,
  "weekStart": "2026-09-07",
  "weekEnd": "2026-09-11",
  "researchedAt": "2026-09-11T18:00:00-03:00",
  "selectionNote": "Critério de seleção e eventuais limitações.",
  "stories": [
    {
      "title": "Título da notícia",
      "eventDate": "2026-09-10",
      "summary": "Fatos verificados.",
      "context": "Contexto necessário para entender.",
      "commentary": "Comentário claramente separado dos fatos.",
      "classification": "analise",
      "sources": [
        {
          "name": "Nome da fonte",
          "title": "Título original do documento",
          "url": "https://example.com/documento",
          "publishedAt": "2026-09-10T12:00:00-03:00"
        }
      ],
      "pages": [
        {"label":"CAPA","title":"Título de abertura","body":"Apresentação breve.","sourceIndexes":[0]},
        {"label":"NOTÍCIA","title":"O que aconteceu","body":"Fatos em linguagem simples.","sourceIndexes":[0]},
        {"label":"CONTEXTO","title":"Por que importa","body":"Contexto documentado.","sourceIndexes":[0]},
        {"label":"ANÁLISE","title":"Nossa leitura","body":"Análise com limites explícitos.","sourceIndexes":[0]}
      ],
      "captions": {
        "instagram": "Legenda para Instagram.",
        "threads": "Legenda para Threads.",
        "tiktok": "Legenda para TikTok."
      }
    }
  ]
}
```

O exemplo acima demonstra a estrutura, não é notícia real. Produzir normalmente quatro objetos em stories.

Limites: título da notícia 140 caracteres; summary/context/commentary 700 cada; selectionNote 1.000; de 1 a 3 fontes, com name 100, title 180 e url 1.000; título de página 100 e body 600; legendas Instagram/TikTok 2.200 e Threads 500. Preferir textos bem abaixo desses tetos para leitura confortável.

`classification`: `analise` ou `inferencia`. Labels aceitos: `CAPA`, `NOTÍCIA`, `CONTEXTO`, `EXEMPLO`, `ANÁLISE`, `INFERÊNCIA`, `FONTES`. A primeira página deve ser CAPA; incluir ao menos uma NOTÍCIA e uma ANÁLISE ou INFERÊNCIA. sourceIndexes começa em zero e deve apontar para fontes existentes. Datas devem ser reais e coerentes; researchedAt é o horário efetivo da pesquisa. publishedAt é ISO com fuso; quando a fonte só informa a data, usar 00:00:00 no fuso conhecido e declarar essa precisão limitada em selectionNote. Não inventar a data de publicação: buscar outra fonte datada.

Antes de entregar, na pasta do projeto executar com Node 22 ou superior:

```powershell
node scripts/validate-radar.mjs "output/radar/radar-AAAA-MM-DD.json"
```

Corrigir qualquer erro estrutural; a validação não confere a veracidade das notícias. Entregar link para o JSON e uma lista curta com os quatro títulos e o período. Não importar automaticamente, não enviar ao Buffer e não publicar. O usuário importa e revisa.

## No sistema

No **Calendário → Importar Radar preparado pelo Codex**, selecionar o arquivo, conferir a lista/prévia e clicar em **Importar carrosséis para revisão**. O sistema salva cada notícia como um conteúdo independente na sexta da pesquisa, já com uma versão de páginas e legendas. É possível reagendar os cartões individualmente. Não há dependência de compras ou cotações para importar notícias.

Abrir cada cartão, conferir os links em Pesquisa do Codex e todas as artes, editar os textos se necessário e confirmar a revisão. Depois baixar ZIP/vídeo ou preparar e aprovar o envio pelo Buffer. Nenhuma revisão ou publicação é confirmada pelo arquivo importado.

Reimportar a mesma fonte principal na mesma semana preserva o conteúdo existente, inclusive suas edições, revisões e publicações; não cria outra cópia nem aplica silenciosamente correções. Use Editar textos do carrossel para corrigir o conteúdo existente. Trocar apenas parâmetros utm não cria duplicatas. Notícias com URLs diferentes ainda exigem conferência editorial para evitar repetição do mesmo fato.

O cartão semanal antigo permanece disponível para histórico; se estiver vazio, pode ser pausado em Planejamento e observações para usar somente os quatro novos cartões. A coleta RSS automática foi desativada. O formulário antigo de RSS permanece disponível apenas nos cartões tradicionais.

As pesquisas, páginas, fontes e legendas entram no backup editorial existente. Não são necessários novos segredos, serviços, migrations ou chamadas de API OpenAI pelo sistema para esse fluxo.
