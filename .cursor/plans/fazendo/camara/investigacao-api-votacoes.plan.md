---
name: investigacao-api-votacoes-camara
overview: O que a fonte oficial da Câmara entrega sobre deputados e votações — volume, vocabulário, ausências, relações com proposições e o recorte viável para a primeira entrega.
todos: []
isProject: false
---

# `Votações da Câmara — o que o dado aguenta`

> **Leia antes de modelar o domínio Câmara.**
> Cada número abaixo foi medido contra a fonte oficial em 16/08/2026.

---

## Método

Foram cruzados:

- `GET https://dadosabertos.camara.leg.br/api/v2/api-docs`;
- `GET /api/v2/deputados`, sem filtro de tempo, para o retrato de quem está em exercício;
- os arquivos anuais `votacoes`, `votacoesVotos`, `votacoesProposicoes` e
  `votacoesObjetos`, de 2023 a 2026;
- `GET /deputados/{id}` e `GET /deputados/{id}/historico` para conferir vacância e
  substituição;
- `GET /dadosabertos/processo?sigla=PEC&numero=221&ano=2019`, do Senado, para acompanhar
  a matéria revisora depois das votações da Câmara;
- o Regimento Interno da Câmara, art. 17, § 1º, para interpretar o código `Artigo 17`.

A própria Câmara recomenda a API REST para seleções pequenas e os arquivos para conjuntos
completos. Os arquivos são atualizados diariamente.

---

## 1. O retrato atual tem exatamente 513 deputados

`GET /deputados` sem `idLegislatura`, `dataInicio` ou `dataFim` lista somente quem está em
exercício no momento da consulta. Em 16/08/2026 foram **513 IDs únicos**, distribuídos nas
27 UFs conforme o número constitucional de cadeiras.

Isso resolve a lacuna imediata do produto: `Nikolas Ferreira` aparece com ID `209787`,
partido, UF, foto e página oficial.

**Limite importante:** “em exercício” não significa “candidato em outubro”. A API da Câmara
não é a fonte de registro de candidaturas. A tela pode dizer **deputado em exercício**, nunca
“na urna”; essa segunda afirmação depende do TSE.

O endpoint é paginado e limita a resposta a 100 itens. Buscar os 513 exige seguir seis
páginas — não fixar o número de páginas no código, seguir o link `next`.

---

## 2. Volume da legislatura atual

| Ano | Votações, todos os órgãos | Votações com linhas de voto | Linhas de voto |
| --- | ---: | ---: | ---: |
| 2023 | 10.831 | 447 | 128.679 |
| 2024 | 10.371 | 448 | 116.400 |
| 2025 | 13.825 | 550 | 175.067 |
| 2026 até 13/08 | 7.021 | 149 | 50.581 |
| **Total** | **42.048** | **1.594** | **470.727** |

O Plenário é o recorte comparável ao Senado e concentra quase todos os votos individuais:

| Ano | Registros de Plenário | Nominais públicas | Linhas públicas |
| --- | ---: | ---: | ---: |
| 2023 | 1.090 | 300 | 123.242 |
| 2024 | 2.144 | 273 | 110.462 |
| 2025 | 2.041 | 428 | 170.796 |
| 2026 até 13/08 | 1.268 | 120 | 49.371 |
| **Total** | **6.543** | **1.121** | **453.871** |

O dado mais recente é de **13/08/2026**, três dias antes da medição. Os arquivos de 2026
foram regenerados na manhã de 16/08/2026.

### Custo operacional muda o primeiro recorte

Para reconstruir voto, descrição e proposições afetadas de 2023–2026, os três conjuntos JSON
somam aproximadamente **347 MB antes do parse**. O recorte de 2026 soma cerca de **41 MB**.
Como o backend ainda lê a origem e guarda cache em memória, começar pela legislatura inteira
criaria um cold start caro e risco de memória sem melhorar a descoberta dos 513 nomes.

**Decisão da primeira entrega:** Plenário de 2026. A UI declara o período; ampliar para o
mandato inteiro deve vir junto de ingestão persistida, não de mais centenas de MB por request.

---

## 3. O vocabulário tem seis valores, mas só quatro são escolha

Nas 1.121 votações nominais públicas do Plenário em 2023–2026:

| Código oficial | Ocorrências | Classificação |
| --- | ---: | --- |
| `Sim` | 268.984 | voto — sim |
| `Não` | 177.484 | voto — não |
| `Obstrução` | 5.272 | voto/posição — obstrução |
| `Abstenção` | 1.091 | voto — abstenção |
| `Artigo 17` | 1.040 | presidiu a sessão; não era voto de conteúdo |
| string vazia | 421 | placeholder de uma votação secreta de 2025 |

`Artigo 17` não é ausência. O art. 17, § 1º do Regimento diz que o presidente não vota em
Plenário, salvo as exceções regimentais. O código entra como `not_eligible`.

A string vazia apareceu em **uma única votação secreta**, `2576389-4`, nas 421 linhas. O
registro geral traz placar (388 sim, 22 não, 11 abstenções), mas não revela a escolha de cada
deputado. A votação inteira deve ficar fora do retrospecto individual.

Nos 120 casos públicos de 2026, o vocabulário foi:

- `Sim`: 31.506;
- `Não`: 17.619;
- `Abstenção`: 124;
- `Artigo 17`: 87;
- `Obstrução`: 35.

---

## 4. A ausência que o Senado publica não existe aqui

O endpoint `/votacoes/{id}/votos` documenta explicitamente: **deputados ausentes não são
listados**. O arquivo anual segue a mesma regra.

Consequências:

- falta de linha pode ser ausência, licença, vacância ou ainda não exercício;
- não é possível copiar o `eligibleCount` do Senado;
- `X de 120` sugeriria falsamente que o deputado podia votar nas 120;
- taxa de participação sem reconstruir todos os períodos de exercício é dado inventado.

Na primeira entrega, o card mostra somente **quantas escolhas a Câmara publicou**, sem taxa.
O denominador das barras é “votos registrados”, não “votações elegíveis”.

Em 2026, os 513 deputados atualmente em exercício têm ao menos uma posição publicada, mas o
denominador varia de 1 a 120. Há ainda **53 IDs** de ex-deputados e suplentes que votaram no
ano e já não estão no retrato atual. Eles permanecem nas votações, mas não entram na lista de
deputados em exercício.

---

## 5. O placar da Câmara é confiável — e foi cruzado

Ao contrário do Senado, `votosSim`, `votosNao` e `votosOutros` vêm preenchidos. Nas **1.121
votações nominais públicas do Plenário** de 2023–2026, os totais bateram em 1.121/1.121 com a
contagem das linhas individuais:

```text
votosOutros = Abstenção + Obstrução + Artigo 17
```

O campo `aprovacao` não tem a mesma completude: falta em **191 de 1.121** votações. Não
inferir o resultado da maioria de `Sim` e `Não`, porque a pergunta votada pode ser “manter” ou
“suprimir” um texto e o quórum pode ser qualificado. A primeira entrega mostra a descrição
oficial e o placar; só mostra resultado estruturado quando a fonte o informar.

---

## 6. Uma votação pode afetar mais de uma proposição

Nas 120 nominais públicas de 2026:

- 108 afetam uma proposição;
- 12 afetam duas proposições;
- zero ficam sem proposição afetada;
- são 89 proposições únicas.

Os casos duplos não são duplicata. Uma votação de requerimento de urgência pode afetar o
`REQ` e o `PL` substantivo; um recurso pode afetar o `REC` e o projeto original. Escolher um
deles como “a matéria verdadeira” seria inferência editorial.

`votacoesObjetos` é ainda menos seguro para agrupamento: entre as mesmas 120 votações, há de
zero a **212 possíveis objetos**. A própria documentação avisa que o objeto real pode não ser
nenhum dos listados.

**Decisão da primeira entrega:** no voto a voto, listar todas as proposições afetadas, cada
uma com seu link oficial. Na aba Pautas, agrupar por **cada relação oficial**: a votação que
afeta duas proposições aparece nos dois grupos. A cobertura distingue 120 votações únicas de
132 relações, e a tela explica a repetição. Assim nenhuma proposição é promovida a principal.

---

## 7. Contrato da primeira fatia

- Fonte de pessoas: `/api/v2/deputados`, retrato atual, seguindo paginação.
- Fonte de retrospecto: arquivos de 2026 `votacoes`, `votacoesVotos` e
  `votacoesProposicoes`.
- Escopo: somente `siglaOrgao === 'PLEN'`, com voto individual público.
- Se qualquer linha da votação tiver código vazio, a votação é secreta e sai do retrospecto.
- `Artigo 17` é `not_eligible`, nunca ausência.
- Ausência e taxa de participação não são publicadas.
- Todas as proposições afetadas sobem para a linha do voto, sem eleger uma como principal.
- Pautas são agrupadas por todas as relações oficiais; repetição entre grupos é explícita.
- Nome popular só sobe com uma página oficial que use aquele rótulo; o alias e sua fonte
  fazem parte da resposta da API e da busca.
- “Decidida no fio” é métrica da 10xGov: diferença menor que 10% entre `Sim` e `Não`, com
  ao menos 20 votos decisivos. Em 17/08/2026, são 3 das 120 votações, em 2 proposições.
- Links da API e das proposições oficiais acompanham a resposta.

---

## 8. Lições que viram regra

### Produto

1. **“Em exercício” não é “na urna”.** A Câmara resolve a busca pelos 513 deputados atuais;
   candidatura continua sendo domínio do TSE.
2. **Contagem publicada não é taxa de participação.** Sem ausentes e períodos de exercício,
   a taxa seria uma acusação construída pela aplicação, não um dado oficial.
3. **Plenário e comissão são universos diferentes.** A primeira tela declara Plenário; uma
   futura visão de comissões precisa de contrato e denominador próprios.

### Modelagem

4. **O contrato canônico de voto é reutilizável; o dicionário da fonte não é.** Os quatro
   rótulos de escolha coincidem com o Senado, mas `Artigo 17` e string vazia exigem
   normalização específica da Câmara.
5. **Linha não garante escolha.** Assim como `Votou` no Senado, o vazio da secreta da Câmara
   parece uma linha útil e precisa ser excluído antes de qualquer agregado individual.
6. **Placar e resultado são coisas diferentes.** O placar foi confirmado em 1.121/1.121;
   `aprovacao` faltou em 191 e não pode ser deduzida da maioria numérica.
7. **Relação parlamentar-partido pertence ao momento do voto.** O retrato atual serve para o
   card; o partido gravado na linha histórica serve para explicar aquela decisão.
8. **Proposição afetada não é objeto único.** Preservar as duas relações custa pouco e evita
   escolher editorialmente entre requerimento/recurso e projeto substantivo. Na leitura por
   pauta, repetir a votação nos dois grupos é mais honesto do que apagar uma relação.

### Operação e método

9. **REST para retrato, arquivo para massa.** Seguir `next` no cadastro atual e usar o arquivo
   anual para voto evita tanto página fixada quanto centenas de requests por votação.
10. **Volume faz parte do contrato.** Os 347 MB da legislatura atual não cabem honestamente
    num cold start ingênuo; 2026 é uma fatia deliberada, e o mandato inteiro pede ingestão.
11. **Cruzar conjuntos revela o que o Swagger não mostra.** O sigilo vazio e a multiplicidade
    de proposições só apareceram ao juntar `votacoes`, `votacoesVotos`,
    `votacoesProposicoes` e `votacoesObjetos`.
12. **Separar medição de escolha mantém o tradeoff visível.** “347 MB” é evidência;
    “começar em 2026” é decisão reversível; o plano de implementação não deve misturar os
    dois.
13. **O vocabulário temático pode ser comum; a contagem não.** Câmara e Senado reutilizam
    os mesmos radicais descritivos, mas cada chip conta apenas títulos e ementas oficiais do
    recorte da própria Casa. Tema com zero cards não aparece: um filtro sem destino só ocupa
    espaço. A classificação não cria assunto nem ordena pauta por relevância.
14. **A ementa não contém necessariamente o nome que o público conhece.** A `PEC 221/2019`
    fala em redução da jornada, enquanto o próprio Portal da Câmara a chama de “Escala 6x1”.
    Guardar o alias com a URL oficial permite compreensão e busca sem trocar o título formal.
15. **Contar votação e contar pauta são coisas diferentes.** O filtro tem 3 votações
    apertadas, mas elas pertencem a 2 proposições. A API preserva as duas métricas; como o
    botão filtra cards, sua pill mostra 2, exatamente o total que aparecerá após o clique.
16. **Retrospecto e tramitação respondem perguntas diferentes.** Na `PEC 221/2019`, a Câmara
    publica três votações em 27/05/2026: requerimento por 372×101, primeiro turno por 472×22
    e segundo turno por 461×19. O Senado registra a chegada da matéria revisora em 28/05 e
    situação `AGUARDANDO DESPACHO`; sem cruzar as duas Casas, o produto mostra o passado mas
    não explica o que falta.
17. **Data do evento não é data de atualização da fonte.** A situação atual começou em
    28/05/2026, mas o processo foi atualizado em 08/07/2026. A resposta preserva os dois
    campos e o formatador aceita tanto `YYYY-MM-DD` quanto timestamp ISO, sem deslocamento
    por fuso.
18. **Uma proposição por linha suporta a densidade sem esconder contexto.** PEC, MPV, PL ou
    qualquer outro tipo ocupa a largura inteira. Dentro do card, `Votações` guarda os eventos
    nominais e `Tramitação` usa uma linha do tempo vertical: fato concluído leva data e
    placar; etapa futura diz explicitamente que ainda não há data publicada.
19. **“Aguardando despacho” suspende, na prática, o relógio seguinte.** O art. 356 do
    Regimento dá à CCJ até 30 dias para emitir parecer, mas a contagem começa no despacho da
    Presidência. Na `PEC 221/2019`, o despacho ainda não foi publicado; portanto, o prazo da
    comissão ainda não começou. A tela calcula os dias civis desde 28/05 e explica qual ato
    falta agora.
20. **Contexto político documentado não é motivo oficial.** Reuniões, sessão temática e
    posições públicas sobre votar antes ou depois das eleições ajudam a compreender a espera,
    mas a tramitação não registra uma justificativa formal. A API preserva essa distinção e
    cada evento contextual leva sua própria fonte oficial.
    Em 14/08, Davi Alcolumbre anunciou ter determinado o encaminhamento da PEC às comissões;
    em 17/08, o processo oficial ainda mostrava `AGUARDANDO DESPACHO`. A interface expõe as
    duas fontes e a divergência, sem escolher uma como realidade escondida da outra.
21. **A linha do tempo deve encerrar a própria narrativa.** Quórum e desfechos pertencem aos
    turnos e à etapa final; repeti-los em três caixas abaixo da sequência cria dois lugares
    concorrentes para a mesma informação.
22. **Autoria precisa conservar partido e UF publicados com a proposição.** A página oficial
    identifica Reginaldo Lopes (`PT-MG`) como autor da `PEC 221/2019`. O card mostra essa
    autoria logo abaixo do título e liga ao registro da Câmara, sem deduzir filiação a partir
    do cadastro atual de deputados.

### Otimização a fazer na fonte

Para oferecer a taxa do mandato inteiro sem acusar injustamente suplentes e afastados, falta
uma fonte agregada de períodos de exercício. Se ela não existir nos arquivos oficiais, a
solução correta é persistir a ingestão do histórico de status — nunca inferir ausência pela
falta de voto.

---

## Perguntas em aberto

- Qual fonte agregada permite reconstruir, sem 513 chamadas, os períodos exatos de exercício
  e afastamento para um denominador de participação?
- A votação secreta de 2025 com string vazia é regra estável ou defeito daquele evento?
- Quando o histórico completo for persistido, vale expor comissões separadamente do Plenário?
