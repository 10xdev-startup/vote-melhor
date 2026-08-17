---
name: camara-vertical-2026
overview: Entregar as leituras por Deputados e por Pautas das votações nominais do Plenário em 2026, com fonte oficial e sem inventar ausências ou proposição principal.
todos: []
isProject: false
---

# `Câmara — Deputados e Pautas de 2026`

---

## Problema

A 10xGov cobre o Senado, mas não encontra nenhum dos 513 deputados federais em exercício.
Copiar o modelo do Senado também produziria uma taxa falsa, porque a Câmara omite ausentes
das linhas de voto e exige outro contrato.

---

## Solução

Criar uma fatia vertical em `/camara`, com aba na URL: lista pesquisável dos 513 deputados
atuais, filtros combináveis de estado e partido, retrospecto voto a voto e Pautas agrupadas por todas as
proposições afetadas. O backend cruza o retrato paginado de deputados com os três arquivos
oficiais de 2026, limita o recorte ao Plenário e preserva todas as relações publicadas.

Quando uma votação afeta duas proposições, ela aparece nos dois grupos; a cobertura distingue
votações únicas de relações. Não entram nesta fatia: taxa de participação, ausências,
comissões, histórico 2023–2025 ou alegação de que o deputado será candidato em outubro.

---

## Checklist resumida

```text
Fase 0: registrar a medição e congelar o contrato honesto
Fase 1: normalizar o vocabulário específico da Câmara
Fase 2: ler e cruzar as quatro respostas oficiais com cache
Fase 3: expor GET /deputies e GET /deputies/:id
Fase 4: expor GET /camara/votacoes e GET /camara/votacoes/:id
Fase 5: entregar /camara com Deputados e Pautas
Fase final: testes filtrados + validação real + gates do dev
```

---

## Passo a passo

### Fase 1 — Vocabulário de voto

**Objetivo:** representar escolha, presidência e sigilo sem reaproveitar códigos do Senado.

1. Em `backend/src/utils/normalizeCamaraVote.ts`, mapear os seis valores medidos.
2. Classificar `Artigo 17` como `not_eligible` e string vazia como `secret`.
3. Em `backend/src/tests/normalizeCamaraVote.test.ts`, cobrir todo o vocabulário e código
   desconhecido.

**Validação parcial:** teste filtrado passa e nenhum placeholder secreto vira escolha.

**Commit sugerido:** `feat(camara): normaliza o vocabulario de voto da Camara`

---

### Fase 2 — Fonte oficial e cache

**Objetivo:** obter o recorte de 2026 sem espalhar o schema externo pelo domínio.

1. Em `backend/src/types/camara.ts`, espelhar somente os campos medidos.
2. Em `backend/src/utils/fetchCamara.ts`, seguir a paginação de deputados e baixar em
   paralelo `votacoes`, `votacoesVotos` e `votacoesProposicoes` de 2026.
3. Validar HTTP, tamanho, JSON vazio/inválido e schema mínimo; guardar `Last-Modified` e cache
   por seis horas.
4. Filtrar Plenário, votações com linhas individuais e remover votação secreta inteira.
5. Em `backend/src/tests/fetchCamara.test.ts`, testar paginação, recorte e sigilo.

**Validação parcial:** módulo real devolve 513 deputados, 120 votações e 49.371 linhas.

**Commit sugerido:** `feat(camara): adiciona cliente da fonte oficial da Camara`

---

### Fase 3 — API por deputado

**Objetivo:** oferecer o mesmo dado da UI numa API wrapped e citável.

1. Em `backend/src/models/DeputyModel.ts`, agregar somente escolhas publicadas, sem taxa de
   participação, e montar o detalhe com partido da época, placar e todas as proposições.
2. Criar `DeputyController` e `deputyRoutes` com `GET /deputies` e `GET /deputies/:id`.
3. Registrar as rotas no `index.ts`, mantendo a autenticação igual ao domínio Senado até a
   decisão pendente sobre abertura das APIs públicas.
4. Em `backend/src/tests/deputyModel.test.ts`, cobrir lista atual, suplente fora do retrato,
   ausência não inferida, ordenação, partido histórico, fontes e múltiplas proposições.

**Validação parcial:** testes filtrados passam e Nikolas Ferreira aparece no módulo real.

**Commit sugerido:** `feat(camara): expoe retrospecto de 2026 por deputado`

---

### Fase 4 — API por pauta

**Objetivo:** oferecer a leitura inversa do mesmo conjunto sem escolher uma proposição
principal.

1. Em `backend/src/models/CamaraVotingModel.ts`, agrupar cada votação por todas as
   proposições afetadas e ordenar cronologicamente dentro do grupo.
2. Expor `GET /camara/votacoes` e `GET /camara/votacoes/:id`, com resposta wrapped, fontes e
   posições individuais publicadas.
3. Separar na cobertura votação única, proposição única e relação oficial.
4. Em `backend/src/tests/camaraVotingModel.test.ts`, cobrir relação dupla, resultado nulo,
   partido histórico e ausência não inferida.

**Validação parcial:** duas proposições afetadas preservam a mesma votação nos dois grupos.

**Commit sugerido:** `feat(camara): expoe pautas e votos de 2026`

---

### Fase 5 — Tela da Câmara

**Objetivo:** permitir encontrar qualquer deputado atual e inspecionar seus votos publicados.

1. Criar tipos, service e formatador do domínio Câmara no frontend.
2. Criar `app/(dashboard)/camara/page.tsx`, `DeputadosPanel.tsx` e `PautasPanel.tsx`.
3. Reutilizar `PartyFilter` e a paleta neutra do `VotePill`; parametrizar o nome da fonte no
   tooltip que hoje cita o Senado.
4. Compartilhar com o Senado as tags temáticas por radicais; contar e filtrar sobre os
   títulos e ementas oficiais da própria Câmara.
5. Mostrar nomes populares sob o título formal somente quando houver fonte oficial; incluir
   alias e procedência na API e na busca (`PEC 221/2019` → `Escala 6x1`).
6. Oferecer “Só as decididas no fio” com o mesmo critério neutro do Senado; contar votações
   únicas na cobertura e pautas no resultado filtrado.
7. Usar abas `Deputados` e `Pautas` em `?tab=`, como no Senado.
8. Manter uma proposição por linha, independentemente de ser PEC, MPV, PL ou outro tipo.
9. Para a `PEC 221/2019`, cruzar a tramitação oficial do Senado e oferecer, dentro do card,
   as abas `Votações` e `Tramitação`; mostrar em linha do tempo vertical os placares da
   Câmara, as datas publicadas, o quórum `49/81` em cada turno e os dois desfechos na etapa
   final. Na etapa atual, explicar o ato que falta, que o prazo da CCJ ainda não começou e o
   contexto público documentado, sem apresentá-lo como justificativa formal.
10. Adicionar `/camara` à sidebar.
11. Escrever teste de componente com services mockados para busca, tags, abas e detalhes.
12. Separar a lista de deputados por UF com pills contadas e combináveis com o filtro de
    partido. Recalcular cada linha pelo filtro da outra, mantendo opções zeradas visíveis e
    ambos os critérios neutros.

**Validação parcial:** busca por `Nikolas Ferreira` abre seu retrospecto; Pautas explica 120
votações únicas em 132 relações e abre as posições publicadas.

**Commit sugerido:** `feat(camara): cria tela de deputados e votos de 2026`

---

### Fase final — Validação (smoke test)

- Agente: `npm test -w backend -- src/tests/normalizeCamaraVote.test.ts`.
- Agente: `npm test -w backend -- src/tests/fetchCamara.test.ts`.
- Agente: `npm test -w backend -- src/tests/deputyModel.test.ts`.
- Agente: `npm test -w backend -- src/tests/camaraVotingModel.test.ts`.
- Agente: `npm test -w backend -- src/tests/fetchSenadoProcess.test.ts src/tests/legislativeJourneyModel.test.ts`.
- Agente: `npm test -w frontend -- tests/deputadosPanel.test.tsx tests/legislativeFormat.test.ts`.
- Dev: `npm run typecheck -w backend && npm run lint -w backend`.
- Dev: `npm run typecheck -w frontend && npm run lint -w frontend`.
- Recarregar a página depois do backend mudar, para não misturar componente novo e payload
  velho pelo Fast Refresh.
- Abrir `/camara`, buscar `Nikolas Ferreira`, conferir partido/UF/foto e abrir o detalhe.
- Abrir `?tab=pautas`, conferir uma votação relacionada a duas proposições e abrir o detalhe.
- Confirmar que a tela diz “votos publicados”, não mostra ausência nem taxa de participação.
- Edge case: uma votação com string vazia não aparece no retrospecto individual.

---

## Diagrama: estado atual vs. desejado

### Atual

```text
Câmara oficial                           (fonte mapeada, não integrada)
     │
     └──► DataRoadmapModel               (existente)

GET /senators + /senado                 (existente — somente Senado)
     │
     └── 513 deputados atuais ausentes da busca
```

### Desejado

```text
API /deputados + arquivos 2026 da Câmara
     │
     ▼
backend/src/utils/fetchCamara.ts         ✨ NOVO
     ├─ segue paginação dos 513 atuais
     ├─ cruza votações + votos + proposições afetadas
     ├─ limita a PLEN + voto individual público
     └─ cache de seis horas
     │
     ▼
backend/src/models/DeputyModel.ts        ✨ NOVO
     ├─ lista por pessoa, sem taxa inventada
     └─ detalhe com placar + todas as proposições
     │
     ├──► GET /deputies                  ✨ NOVO
     └──► GET /deputies/:id              ✨ NOVO
     │
     └──► backend/src/models/CamaraVotingModel.ts  ✨ NOVO
              ├──► GET /camara/votacoes
              └──► GET /camara/votacoes/:id
                       │
                       ▼
frontend/app/(dashboard)/camara          ✨ NOVO
     ├─ abas Deputados e Pautas em `?tab=`
     ├─ busca nome / partido / UF
     ├─ filtros combináveis de estado e partido
     ├─ pauta por todas as proposições afetadas
     ├─ tags temáticas com contagem do recorte
     ├─ nome popular com link para a fonte oficial
     ├─ filtro de votações decididas no fio
     ├─ PartyFilter                      (existente)
     ├─ distribuição de escolhas publicadas
     └─ VotePill + links oficiais        (existente — fonte parametrizada)

┌──────────────────────────────────────────────────────────────────────┐
│ Período: 2026 · órgão: Plenário · somente votos individuais públicos │
│ Não há campo de ausência nem taxa de participação no contrato.       │
└──────────────────────────────────────────────────────────────────────┘
```
