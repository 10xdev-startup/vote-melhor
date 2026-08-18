---
name: investigacao-api-votacoes
overview: O que a API de dados abertos do Senado entrega de fato em votações nominais — vocabulário, buracos, contradições entre endpoints e o limite que tramitação expõe.
todos: []
isProject: false
---

# `Votações nominais do Senado — o que o dado aguenta`

> **Leia antes de modelar schema de votação.**
> Cada número abaixo foi medido contra a API real em 16/08/2026, não estimado.
> Quatro achados aqui contradizem premissas do `api.plan.md` — ver a seção final.

---

## Método

Baixados os 36 anos completos (`1991`–`2026`) de
`GET https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=AAAA-01-01&dataFim=AAAA-12-31`,
com `Accept: application/json`, e cruzados com:

- `GET /dadosabertos/plenario/votacao/orientacaoBancada/{AAAAMMDD}`
- `GET /dadosabertos/plenario/lista/tiposComparecimento`
- `GET /dadosabertos/processo?sigla={sigla}&ano={ano}`
- `GET /dadosabertos/v3/api-docs` (157 endpoints)

---

## 1. A superfície de API é quase toda legada

Dos endpoints de votação na spec, **um só não está `DEPRECATED`**: `GET /dadosabertos/votacao`.

| Endpoint | Situação |
| --- | --- |
| `/votacao` | **ativo** — voto individual, filtros por sessão/processo/parlamentar |
| `/plenario/votacao/orientacaoBancada/{data}` | ativo — orientação de liderança |
| `/plenario/lista/votacao/{dataSessao}` | DEPRECATED |
| `/plenario/lista/votacao/{dataInicio}/{dataFim}` | DEPRECATED |
| `/plenario/votacao/nominal/{ano}` | DEPRECATED — **responde 200 com 0 bytes** |
| `/materia/votacoes/{codigo}` | DEPRECATED |
| `/senador/{codigo}/votacoes` | DEPRECATED |

`/plenario/votacao/nominal/{ano}` merece destaque: devolve `HTTP 200` e corpo vazio para
todo ano testado (2014, 2015, 2016, 2017). Um cliente que trate 200 como sucesso registra
"zero votações" em vez de erro — falha silenciosa.

**Consequência:** construir sobre qualquer coisa que não seja `/votacao` é construir sobre areia.

### Formato de data é inconsistente entre endpoints

- `/votacao` exige `AAAA-MM-DD` (`2026-03-24`)
- `/orientacaoBancada` exige `AAAAMMDD` (`20260324`) — com hífen devolve `404`

### `tiposComparecimento` responde 301

Redireciona para `/dadosabertos/dados/ListaTiposComparecimento.json`. `curl` sem `-L` recebe
0 bytes. Vale pra camada de fetch: **`node:https` não segue redirect por padrão** — e é
`node:https` que o `fetchSourceFile.ts` usa (ver [[investigacao-tls-senado]]).

---

## 2. Volume: o dataset inteiro é pequeno

**3.647 votações nominais e 288.774 votos individuais**, de 1991 a 2026. Cabe em Postgres
sem particionamento, sem sharding, sem fila.

Latência medida: **~1s por ano**, 2,4 MB para 2025. Puxar a legislatura atual inteira
custa 4 chamadas e ~4 segundos.

Frescor: última votação disponível em **12/08/2026**, medido em 16/08/2026 — **4 dias de
atraso**. Serve para acompanhar a eleição em tempo quase real.

### Legislatura atual (2023–2026)

| | |
| --- | ---: |
| Votações no período | 421 |
| Nominais (voto individual existe) | **182** |
| Secretas (só totais) | 239 |
| Votos individuais nas nominais | 14.742 |
| Com ementa **e** identificação | **182/182** |

Composição das 182 nominais: `PLP` 80, `PEC` 54, `PL` 30, `RQS` 7, `MPV` 6, outras 5.
**90% é lei substantiva**, não rito — não precisa filtrar ruído.

Que 182/182 tenham ementa e identificação (`PL 896/2023`) significa que o princípio
"toda resposta cita a fonte" nasce cumprido neste recorte, não vira dívida.

---

## 3. O campo de voto mistura dois domínios

`siglaVotoParlamentar` carrega **22 valores distintos** na série. Só 4 são voto.

| Código | Ocorrências | Significado |
| --- | ---: | --- |
| `Votou` | 100.153 | placeholder de votação secreta — **sem conteúdo** |
| `Sim` | 85.038 | voto |
| `P-NRV` | 44.940 | Presente – não registrou voto |
| `Não` | 22.408 | voto |
| `AP` | 15.666 | Atividade parlamentar |
| `LS` | 5.464 | Licença saúde |
| `NCom` | 5.356 | Não compareceu |
| `MIS` | 3.656 | Missão da Casa no País/exterior |
| `LP` | 1.858 | Licença particular |
| `Presidente (art. 51 RISF)` | 1.716 | presidente não vota |
| `Abstenção` | 1.622 | voto |
| `REP` | 574 | Representação em solenidade |
| `NA` | 73 | Dispositivo não citado |
| `LG` / `LA` / `LAP` | 126 | Licença gestante / adotante / paternidade |
| `P-OD` | 52 | Presente – obstrução declarada |
| `Obstrução` | 39 | voto |
| `Impedido (art.306 RISF)` | 26 | impedimento regimental |
| `MERC` | 5 | **desconhecido** |

**Votos reais somam 109.109 de 288.774 — 37,8%.** Contar linha de `votos[]` como voto
produz erro de 62%.

`Votou`, sozinho, é 34,7% da base e não carrega informação nenhuma: é o que a API devolve
no lugar do voto quando a votação foi secreta.

### A tabela oficial cobre só metade

`ListaTiposComparecimento` traz 55 códigos, mas **só os de comparecimento**. Não documenta
`Votou`, `Sim`, `Não`, `Abstenção`, `Obstrução`, `Presidente (art. 51 RISF)`,
`Impedido (art.306 RISF)` nem `MERC`.

`MERC` (5 ocorrências) permanece sem significado conhecido — não inventar um.

### Classificação adotada

Três categorias, evoluindo depois:

1. **Votou** — `Sim`, `Não`, `Abstenção`, `Obstrução`
2. **Presente sem votar** — `P-NRV`, `P-OD`
3. **Ausente** — o resto

`P-NRV` **não pode** cair no balaio de ausente: 44.940 ocorrências de senador que estava lá
e não registrou voto. Politicamente não é a mesma coisa que faltar.

---

## 4. Totais e votos individuais nunca vêm juntos

Inversão exata, verificada nos 36 anos:

| Tipo | `totalVotosSim/Nao/Abstencao` | `votos[]` |
| --- | --- | --- |
| Nominal | **sempre `null`** | voto real por senador |
| Secreta | **preenchido** | 81 linhas de `Votou`/`NCom` |

**O placar de toda votação nominal tem que ser calculado.** Confirmado por cruzamento:
`sequencialVotacao=4363` conta 67 `Sim` no `/votacao`, e `/orientacaoBancada` reporta
`qtdVotosSim=67` para a mesma votação.

`votos[]` sempre traz **81 entradas** — o Senado inteiro, com código de ausência para quem
não votou. Isso é bom: presença é derivável sem endpoint extra.

---

## 5. Os dois endpoints descrevem a mesma votação de formas diferentes

`sequencialVotacao = 4363` (PL 896/2023, 24/03/2026):

| | `/votacao` | `/orientacaoBancada` |
| --- | --- | --- |
| Linhas de voto | 81 (roster completo) | 67 (só quem votou) |
| Totais | `null` | `qtdVotosSim=67` |
| Vocabulário | `Sim`, `AP`, `NCom`, `P-NRV`, `MIS`, `LS` | `SIM` |
| `codigoParlamentar` | **sim** | **não — só nome** |
| Orientação de bancada | ausente | 14 lideranças |
| Quórum, horários, presidente | ausente | presente |

**Nome de partido diverge entre os dois:**

| `/votacao` | `/orientacaoBancada` |
| --- | --- |
| `PP` | `Progressistas` |
| `PODEMOS` | `Podemos` |
| `REPUBLICANOS` | `Republicanos` |

Somado à ausência de `codigoParlamentar` no `orientacaoBancada`, **juntar os dois exige
casar por nome de parlamentar e normalizar nome de partido**. É o ponto mais frágil de
qualquer integração que queira responder "senador votou contra a orientação do partido".

---

## 6. 2015 e 2016 estão corrompidos

Os anos trazem 17 e 13 votações, contra 85 em 2014 e 146 em 2017. Não é vazio de agenda —
é dado de outra época com `dataSessao` errada.

Prova, no registro datado de `2015-06-30`:

- matéria `PDS 141/1997`, `dataApresentacao: 1996-10-08`
- votantes: **Antonio Carlos Magalhães** (morto em 2007), **Abdias Nascimento** (deixou o
  Senado em 1999), **Artur da Távola** (morto em 2008)
- `codigoParlamentar` de 1 a 7 — os registros mais antigos da base

Confirmado por proxy estatístico: `codigoParlamentar` mediano por ano sobe de forma estável
ao longo da série, e **só 2015 (46) e 2016 (120) despencam** contra ~3.782 esperado pelos
anos vizinhos.

Nenhuma dessas matérias aparece no arquivo do ano correto — ou seja, essas votações estão
**perdidas** do ano real, não duplicadas.

Metadados no mesmo par de anos: **83% de UF nula e 42% de partido `Sem registro` em 2015**
(2014: 1% e 0%).

**Consequência:** qualquer recorte histórico deve excluir 2015–2016 explicitamente, ou
declarar a lacuna na UI. Silenciar é publicar dado errado com cara de oficial.

> Cuidado com o detector ingênuo: `codigoSessao` **não** é cronológico. Cai de ~20.200 em
> 1994 para 23 em 1995 — há duas numerações sobrepostas na base. Usar como chave de ordem
> temporal produz falso positivo em 2010–2017.

### Metadado antigo é fraco por natureza

1991–1994 trazem 23% a 31% de partido `Sem registro`, com esquema de identificação distinto
do resto da série. Não é corrupção — é limite da digitalização. Tratar como qualidade
degradada, não como erro.

---

## 7. Partido é histórico, e isso é uma boa notícia

`siglaPartidoParlamentar` guarda a filiação **no momento do voto**, não a atual.

- **173 de 512** senadores aparecem com mais de um partido na série
- **182** aparecem com dois ou mais partidos **dentro do mesmo ano** — troca no meio do ano
  é capturada

Rastro verificado: Romero Jucá `PFL` (1995–98) → `PSDB` (1999–2003) → `MDB` (2004–). José
Agripino `PFL` → `DEM` em 2007, com o ano de transição registrando as duas siglas.

**Consequência para o modelo canônico:** partido não é atributo de pessoa, é atributo do
voto. E como sigla muda de nome sem mudar de identidade (`PFL`→`DEM`, `PP`↔`Progressistas`),
a entidade Partido precisa de identidade estável com aliases — não basta a sigla como chave.

---

## 8. O achado que muda a ordem de construção

**O Senado ainda não votou nominalmente o fim da escala 6x1.** A série continua com zero
votações nominais sobre jornada, mas a matéria aprovada pela Câmara já chegou à Casa
revisora.

O tema existe — em tramitação, parado:

| Matéria | Apresentada | Situação em 16/08/2026 |
| --- | --- | --- |
| **PEC 221/2019** — texto da Câmara, apelidado `Fim da escala 6x1` | 28/05/2026 | `AGUARDANDO DESPACHO` |
| **PEC 4/2025** — reduz jornada para 40h, teto de 8h diárias | 11/02/2025 | `AGUARDANDO DESPACHO` |
| PL 1927/2026 | 22/04/2026 | `AGUARDANDO DESPACHO` |
| PEC 12/2026 — empregado *escolhe* a jornada | 28/05/2026 | `AGUARDANDO DESIGNAÇÃO DO RELATOR` |
| PLP 201/2026 — mitiga impactos da redução | 09/07/2026 | `AGUARDANDO DESPACHO` |

Na PEC 4/2025, `dataSituacaoAtual` é **igual** à `dataApresentacao`: não andou um dia em 18
meses. Assinada por Cleitinho (REPUBLICANOS/MG), Paulo Paim (PT/RS), Lucas Barreto (PSD/AP),
Plínio Valério (PSDB/AM), Marcio Bittar (UNIÃO/AC) e outros.

**Um produto construído só sobre votações é cego justamente nas pautas mais quentes.** O
usuário busca "6x1" e recebe vazio — não por falta de dado, mas porque a pergunta certa não
é "como votaram", é "por que não votaram".

`/processo` entrega ementa, autoria com partido e UF, `situacaoAtual`, `tramitando` e
`urlDocumento` — link direto para o PDF oficial. Com o filtro exato
`?sigla=PEC&numero=221&ano=2019`, a fonte devolve a matéria `174386`, objetivo `Revisora`,
situação desde 28/05/2026 e última atualização em 08/07/2026. Volume de 2026: 417 `PL`, 44
`PLP`, 10 `PEC`.

---

## 9. O que isto contradiz no `api.plan.md`

O plano foi escrito antes de qualquer medição. Quatro pontos merecem revisão — **não
apagar o plano**, revisar com o dado na mão:

| § do plano | Premissa | O que o dado mostra |
| --- | --- | --- |
| §23 | Vertical slice: Senadores → Proposições → Votações → Votos | Votação é o dataset **mais completo e citável** (182/182 com fonte). Começar por ela custa menos e entrega antes. |
| §23, §7 | Tramitação não aparece em lugar nenhum | É onde vivem as pautas de maior interesse. Sem ela, o produto não responde "6x1". |
| §7 | `Person + Mandate + Party` como modelo canônico | Partido é atributo **do voto**, não da pessoa, e precisa de aliases (`PFL`→`DEM`, `PP`↔`Progressistas`). |
| §2–§4 | `SenadoClient` como camada HTTP genérica | Dois endpoints da mesma API divergem em formato de data, nome de partido e chave de junção. A normalização começa **dentro** do Connector, não depois. |

---

## Perguntas em aberto

- O que é `MERC`? Não está em nenhuma tabela oficial encontrada.
- As votações perdidas de 2015–2016 existem em algum outro endpoint, ou sumiram da base?
- `/orientacaoBancada` cobre quantos anos para trás? Testado só em 2025 e 2026.
- Votações em comissão (`/votacaoComissao/*`) têm o mesmo vocabulário de voto do plenário?
