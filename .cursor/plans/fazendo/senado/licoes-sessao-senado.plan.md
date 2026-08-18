---
name: licoes-sessao-senado
overview: O que esta sessao ensinou sobre ambiente, metodo e armadilhas de dado ao construir o dominio Senado.
todos: []
isProject: false
---

# `Licoes da sessao que construiu o dominio Senado`

> Sessao de 16/08/2026. As licoes de **dado** estao em
> [[investigacao-api-votacoes]]; aqui ficam as de **ambiente, metodo e ferramenta**.

---

## P0 — bloqueia producao

### 1. Os Dockerfiles pinam Node 20 e o `supabase-js` exige 22

`@supabase/supabase-js@2.112.2` declara `engines: node >=22.0.0` e o `createClient` **estoura
na construcao** no Node 20:

```
Error: Node.js detected but native WebSocket not found.
```

O client e lazy (Proxy em `database/supabase.ts`), entao o servidor sobe e `/health` responde
— **quebra so quando uma rota autenticada toca o banco**. Em dev da para contornar com
`NODE_OPTIONS=--experimental-websocket`, mas:

- `backend/Dockerfile:1` e `frontend/Dockerfile:1` usam `node:20-alpine`
- em producao nao existe `npm run dev` onde enfiar a flag

**Fix na fonte:** `node:22-alpine` nos dois Dockerfiles, `.nvmrc` e `engines` no
`package.json`. O `README.md` ainda diz "Requer Node.js 20 ou superior" — tambem esta errado.

### 2. `npm ci` com npm 10.8.2 suja o lockfile e trava o checkout

O npm que vem com o Node 20 nao conhece o campo `libc` e o apaga do `package-lock.json`. O
diff e so metadata (zero mudanca de `version`/`resolved`/`integrity`), mas basta para:

```
error: Your local changes to the following files would be overwritten by checkout:
        package-lock.json
```

Paliativo: `git restore package-lock.json` depois de cada install. Fix real: Node 22, que
traz npm mais novo. Mesma causa raiz do item 1.

---

## P1 — metodo que evitou construir errado

### 3. Medir a fonte antes de modelar — sempre

Toda decisao de schema desta sessao veio de contagem, nao de intuicao. O que isso pegou:

| Suposicao plausivel | O que a medicao mostrou |
| --- | --- |
| "linha em `votos[]` e um voto" | so 37,8% sao; `Votou` de secreta e 34,7% |
| "leio os totais da API" | `totalVotosSim` e sempre nulo em votacao nominal |
| "a serie historica e continua" | 2015 e 2016 tem votacoes dos anos 90 mal datadas |
| "a ultima votacao decide a materia" | acerta em 20% dos casos |
| "tema e busca de texto" | a ementa da PEC 6/2019 nao contem "reforma da previdencia" |

**Custo de medir:** minutos. **Custo de nao medir:** schema errado descoberto depois da UI
pronta.

### 4. Rodar o modulo real contra o dado real, sem subir servidor

O comando que mais rendeu na sessao:

```bash
cd backend && node -r ts-node/register/transpile-only -r tsconfig-paths/register -e '
  const { VotacaoModel } = require("./src/models/VotacaoModel")
  ;(async () => { console.log(await VotacaoModel.listVotacoes()) })()
'
```

Resolve o alias `@/`, nao precisa de build, nao sobe Express e nao passa pelo
`supabaseMiddleware` (que quebraria no Node 20). Foi assim que apareceram, em segundos:

- o `onBallot` invertido (54 x 27)
- as URLs de foto em `http://`
- a cobertura de 99,9983% da tabela de codigos

### 5. Fixture de teste sai do dado real, nao da imaginacao

O teste do placar usa a votacao `sequencialVotacao=4363` com as 81 siglas que a API devolveu,
e o valor esperado (67 `Sim`) foi conferido **contra outro endpoint** (`orientacaoBancada`,
`qtdVotosSim=67`). Fixture inventada teria passado com o bug dentro.

---

## P2 — ferramenta

### 6. `tsc --noResolve` como checagem barata de sintaxe

O `typecheck` completo e do dev (o WSL nao aguenta), mas depois de refatorar JSX da para
validar estrutura sem o grafo de imports:

```bash
npx tsc --noEmit --noResolve --jsx preserve --target esnext --module esnext \
  --moduleResolution bundler "app/(dashboard)/senado/PautasPanel.tsx"
```

Erros `Cannot find module` e ruido de `node_modules/@types` sao esperados e devem ser
filtrados; **qualquer outra coisa e erro de verdade**. Pegou zero falso negativo na sessao.

### 7. Fast Refresh serve codigo novo com dado velho

Sintoma real: a tela mostrou

```
O plenário rejeitou o texto-base e votou undefined destaque à parte, e aprovou.
```

O model no disco nao conseguia produzir isso — 0 materias com texto-base rejeitado, 0 com
contador invalido. O Next trocou o componente a quente e **manteve o payload que ja estava no
state**, buscado antes de o backend ter o campo.

Duas licoes:
1. Antes de investigar bug de tela depois de mexer no backend, **recarregue a pagina**.
2. Campo agregado que pode faltar produz lixo; derivar da lista (que sempre existe) produz
   silencio. Foi o motivo de remover `highlightCount` da API.

### 8. A regex de acento sujou de novo — e o fix do CLAUDE.md funciona

Escrever a classe de combining marks pela tool de escrita entregou os caracteres **literais**
no arquivo, em vez do escape. A regra ja esta no `CLAUDE.md`; o que esta sessao confirma e o procedimento:

```bash
grep -n "u0300" <arquivo>              # tem que casar
grep -nP "[\x{0300}-\x{036f}]" <arquivo>  # tem que vir vazio
```

E o conserto com `python3` montando por codigo (`BS = chr(92)`) + `write_bytes`. Funcionou de
primeira.

**Alternativa melhor quando cabe:** nao usar a regex. O `classifyVotacaoKind` casa
`ressalvado`/`destaque`/`destacad` — nenhum tem acento em qualquer flexao, entao
`toLowerCase()` basta e o arquivo nunca corre o risco.

---

## P3 — produto

### 9. Numero sem denominador mente

Na legislatura atual os denominadores vao de **3 a 584**: quem assumiu como suplente aparece
em poucas votacoes. Ordenar por taxa poe no topo quem votou 3 de 3. Regra que ficou no
codigo: **nunca exibir taxa sem o denominador ao lado**, e avisar abaixo de 50.

### 10. Cor e ordenacao sao decisoes politicas

- `Sim` verde e `Não` vermelho sugere que aprovar e bom. Ficou azul e violeta.
- Ordenar partidos ou temas por "relevancia" e juizo editorial. Ficou por contagem medida.

Neutralidade nao e so a copy — mora na paleta e no `sort`.

### 11. Cobrimos 54 de 567 nomes na cedula

A base e so `casaSessao: 'SF'`: 3.647 votacoes, 535 parlamentares, **zero deputado**. Em
outubro o eleitor escolhe 54 senadores e **513 deputados federais**. Quem busca "Nikolas
Ferreira" recebe vazio.

A API da Camara (`dadosabertos.camara.leg.br/api/v2`) responde em ~0,2s, e REST moderna e ja
esta mapeada no roadmap. `normalizeSenadoVote`, `VotePill`, `PartyFilter`, o agrupamento por
materia e a regra do denominador sao agnosticos de fonte. **O vocabulario de voto nao e** —
medir antes de modelar, como no Senado.
