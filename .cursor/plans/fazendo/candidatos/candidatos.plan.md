---
name: candidatos-diretorio
overview: Criar um diretório público de candidatos ao Congresso no VoteMelhor, com busca, perfis, informações curriculares e registros oficiais. As dificuldades da implementação alimentarão um dossiê posterior.
todos: []
isProject: false
---

# Candidatos — diretório dentro do VoteMelhor

**Estado:** plano revisado; implementação não iniciada.
**Atualizado em:** 20/09/2026, após esclarecimento do usuário.
**Objetivo do produto:** permitir consultar candidatos ao Congresso dentro do sistema, acessar sua trajetória e seus registros oficiais e formar uma decisão própria a partir dessas informações.
**Entrega atual:** corrigir o planejamento. A implementação descrita abaixo ainda será executada.

**Direção confirmada pelo usuário:** primeiro construir e usar o diretório. Registrar as dificuldades reais de acesso, interpretação e integração dos dados durante esse trabalho. Depois, usar esses aprendizados para escrever um dossiê sobre as fontes e o caminho técnico. O dossiê não é a interface dos candidatos nem requisito para disponibilizar seus perfis.

## Problema

Hoje o VoteMelhor consulta parlamentares em exercício e registros de votação. Falta um diretório de candidaturas eleitorais com informações básicas, trajetória profissional e vínculos com os registros legislativos disponíveis.

Parlamentar em exercício, pessoa e candidatura são entidades distintas. Uma pessoa pode concorrer sem nunca ter exercido mandato, e o fim de um mandato não confirma uma nova candidatura. As informações curriculares estão distribuídas entre fontes com cobertura desigual.

## Solução

Implementar uma seção pública **Candidatos**, com lista pesquisável e página individual. O cadastro eleitoral do TSE define as candidaturas; Câmara e Senado complementam os perfis quando houver correspondência de identidade confirmada.

Primeiro recorte proposto: eleições de 2026, deputados federais e senadores. A lista deve incluir as candidaturas do recorte importado, inclusive pessoas sem passagem pelo Congresso. Uma UF pode servir de amostra técnica de validação, mas não transforma o produto em um perfil manual de um candidato escolhido. Declarar na interface quais UFs, cargos e eleição estão efetivamente disponíveis.

### Experiência no sistema

1. Entrar em **Candidatos** pelo menu e consultar a eleição exibida.
2. Filtrar por UF e cargo; pesquisar por nome civil, nome de urna ou número. Partido e situação do registro são filtros factuais adicionais.
3. Ver nome, foto quando disponível, número, partido, cargo, UF e situação do registro, com fonte e data de atualização.
4. Abrir um perfil em URL própria, preservando os filtros ao voltar à lista.
5. Consultar formação, ocupação, trajetória pública e registros legislativos disponíveis, com links oficiais por bloco.

A organização é documental: busca, filtros explícitos, paginação e ordenação alfabética estável. Não haverá pontuação, avaliação curricular, comparação avaliativa, recomendação eleitoral ou personalização por preferências políticas.

### Conteúdo do perfil

| Bloco | Conteúdo e comportamento |
|---|---|
| Identificação eleitoral | Eleição, nome civil/de urna, cargo, UF, número, partido, situação do registro e link oficial. |
| Formação e trabalho | Escolaridade e ocupação declaradas ao TSE; cursos, instituições, atividades e períodos publicados nas biografias disponíveis. |
| Trajetória pública | Cargos e mandatos documentados. Candidatura anterior não equivale a mandato exercido. |
| Atuação parlamentar | Vínculo com os registros da pessoa já cobertos pelo sistema, com período e objeto das votações. |
| Documentos | Links oficiais para informações complementares, incluindo bens e contas quando disponíveis, sem depender de novos cruzamentos financeiros. |
| Fontes e cobertura | Origem, data de coleta/atualização e limites de cada conjunto; diferenças entre fontes permanecem atribuídas. |

Informações biográficas podem ser declaradas mesmo quando publicadas em portal oficial. Não apresentá-las como diplomas ou vínculos verificados independentemente.

Distinguir estados: **não informado pela fonte**, **não localizado nas fontes consultadas**, **vínculo parlamentar ainda não confirmado**, **fora da cobertura desta base** e **fonte temporariamente indisponível**. Nenhum deles significa ausência comprovada de experiência ou de atuação.

## Diagrama: estado atual vs. desejado

### Atual

```text
Câmara / Senado -> modelos de parlamentares em exercício -> páginas e votações

Limite: não há diretório eleitoral nem vínculo confirmado de candidatura.
```

### Desejado

```text
TSE: recursos oficiais de candidaturas
  -> adaptador de leitura e normalização [NOVO]
  -> cache com origem, cobertura e datas
  -> CandidateModel [NOVO]
       |                     |
       |                     +-> vínculo confirmado com Câmara / Senado
       |                          -> biografia e registros disponíveis
       v
CandidateController -> rotas públicas de candidatos [NOVOS]
       |
       v
/candidatos -> filtros + busca + paginação -> /candidatos/[id]
                                              |
                                              v
                             identificação + trajetória + registros + fontes

Durante a implementação:
  erros / lacunas / limites / soluções reproduzíveis
    -> registro técnico local
    -> dossiê posterior sobre os dados e sua integração
```

**Arquitetura proposta:** usar o backend e os mecanismos de acesso a fontes oficiais existentes. Medir tamanho, tempo de carga e memória dos arquivos do TSE antes de fechar o mecanismo de cache. Preferir ingestão/cache simples e leitura pública, sem criar fila, serviço separado ou banco de candidatos por antecipação. A decisão de persistência fica na fase de investigação; nenhuma alteração de banco está especificada ou autorizada por esta revisão documental. Se necessária, detalhar seu contrato no plano antes da implementação correspondente.

O diretório não usa `dossiers` como armazenamento de candidatos e não depende de upload, revisão editorial, publicação administrativa ou PDF para funcionar.

## Mapa de arquivos

Mapa preliminar para a implementação. `N` = novo previsto; `M` = mudança prevista; `B` = existente para reaproveitamento. Estimativas não são contagens de código produzido. Consolidar arquivos quando isso simplificar a solução, após examinar o contrato real do TSE.

```text
Mapa de arquivos
===============================================================================
BACKEND / backend/src/
===============================================================================
Routes + controllers [N]                    2 arquivos, 80–140 linhas estimadas
  routes/candidateRoutes.ts                 leitura pública da lista e do perfil
    -> controllers/CandidateController.ts   valida parâmetros e responde
-------------------------------------------------------------------------------
Models + types [N]                          2 arquivos, 180–300 linhas estimadas
  models/CandidateModel.ts                  consulta e vinculação de registros
  types/candidate.ts                       candidatura, perfil e procedência
-------------------------------------------------------------------------------
Integração oficial [N]                      1 arquivo, 150–250 linhas estimadas
  utils/fetchTseCandidates.ts               leitura, normalização e cache
    -> utils/officialHttpGet.ts [B]         transporte existente; ver referências
-------------------------------------------------------------------------------
Testes [N]                                 3 arquivos, 180–300 linhas estimadas
  tests/tseCandidates.test.ts               parser, falhas e cobertura
  tests/candidateModel.test.ts              identidade, filtros e vínculo
  tests/candidateRoutes.test.ts             contrato público e parâmetros
===============================================================================
FRONTEND / frontend/
===============================================================================
Páginas + componentes [N]                   4 arquivos, 300–500 linhas estimadas
  app/(dashboard)/candidatos/page.tsx       entrada da lista
  app/(dashboard)/candidatos/[id]/page.tsx  perfil com URL própria
  components/candidates/CandidateList.tsx   busca, filtros e paginação
  components/candidates/CandidateProfile.tsx dados, trajetória e fontes
-------------------------------------------------------------------------------
Services + types [N]                        2 arquivos, 70–120 linhas estimadas
  services/candidateService.ts              20–40 linhas | consumo da API
  types/candidate.ts                        50–80 linhas | contrato de leitura
-------------------------------------------------------------------------------
Testes [N]                                 2 arquivos, 120–200 linhas estimadas
  tests/candidateList.test.tsx              filtros, navegação e estados
  tests/candidateProfile.test.tsx           procedência e dados ausentes
===============================================================================
INTEGRAÇÃO COMPARTILHADA [M]                 caminhos existentes, fora das estimativas
===============================================================================
  backend/src/index.ts                     registrar as rotas
  frontend/components/AppSidebar.tsx       adicionar Candidatos
  frontend/lib/publicRoutes.ts             abrir lista e perfis a visitantes
  frontend/tests/publicRoutes.test.ts      conferir os limites das rotas públicas
===============================================================================
DOCUMENTAÇÃO / .cursor/plans/fazendo/candidatos/
===============================================================================
  candidatos.plan.md                       este plano
  execucao-candidatos.md [N, futuro]        evidências e dificuldades encontradas
===============================================================================
```

Referências existentes verificadas em 20/09/2026, fora das estimativas acima: `DeputyModel.ts` (91 linhas), `SenatorModel.ts` (91), `officialHttpGet.ts` (124), `DeputadosPanel.tsx` (373), `AppSidebar.tsx` (244) e `publicRoutes.ts` (12). Não duplicar todo o painel de deputados para obter busca e apresentação de perfis; reaproveitar padrões/componentes que fizerem sentido.

**Ajuste transversal a dimensionar:** `onBallot` envolve `backend/src/models/SenatorModel.ts`, `backend/src/types/senado.ts`, `backend/src/tests/senatorModel.test.ts`, `frontend/types/senator.ts` e `frontend/app/(dashboard)/senado/SenadoresPanel.tsx`. Conferir leitores antes de renomear ou substituir o campo e acrescentar os testes de interface pertinentes ao mapa final.

## Checklist resumida

- [x] Registrar a intenção: diretório no sistema primeiro; dossiê de aprendizados depois.
- [x] Levantar fontes curriculares e identificar o limite do cadastro atual.
- [ ] Fase 0: inspecionar os arquivos do TSE, confirmar chaves, cobertura e custo de leitura.
- [ ] Fase 1: implementar ingestão e API pública de candidaturas.
- [ ] Fase 2: implementar lista pesquisável e perfil individual no sistema.
- [ ] Fase 3: incorporar currículo disponível e vínculos confirmados com registros legislativos.
- [ ] Fase final: validar navegação, identidade, cobertura e falhas de fontes.
- [ ] Depois: consolidar dificuldades reais e produzir o dossiê técnico.

## Fontes oficiais e disponibilidade curricular


Fontes consultadas em 20/09/2026. Os exemplos abaixo comprovam a existência de campos; não representam uma seleção para o diretório e não demonstram cobertura uniforme.

| Fonte | Informações disponíveis | Limite e uso previsto |
|---|---|---|
| [TSE — apresentação do DivulgaCandContas](https://www.tse.jus.br/comunicacao/noticias/2022/Novembro/quer-saber-mais-sobre-os-candidatos-acesse-o-divulgacandcontas) | Escolaridade, ocupação declarada, partido, número, bens, contas e links da candidatura, entre outras informações. | Ocupação e escolaridade não constituem currículo profissional completo. Usar como identificação eleitoral e declaração atribuída à fonte. |
| [TSE — candidatos de 2026](https://dadosabertos.tse.jus.br/pt_PT/dataset/candidatos-2026) | Recursos de candidatos, informações complementares, bens, redes sociais e histórico de candidaturas, entre outros. | A existência dos recursos foi conferida; esquema dos arquivos, chaves, cobertura e correspondência com os IDs legislativos ainda precisam de inspeção. |
| [Câmara — biografia de Adriana Ventura](https://www.camara.leg.br/deputados/204528/biografia) | O exemplo contém escolaridade, profissões, atividades profissionais e cargos públicos, cursos com instituições/períodos, mandatos e atividades parlamentares. | Conteúdo varia por perfil. A página não substitui conferência independente de diplomas ou vínculos. |
| [Câmara — documentação de dados abertos](https://dadosabertos.camara.leg.br/swagger/api.html) | Rotas `/deputados/{id}/ocupacoes`, `/profissoes`, `/mandatosExternos`, `/historico` e `/orgaos`, além do detalhe do deputado. | Profissões e ocupações são declaradas à Câmara. Não presumir que toda informação da biografia HTML esteja em um único endpoint. |
| [Senado — perfil de Fernando Bezerra Coelho](https://www25.senado.leg.br/web/senadores/senador/-/perfil/5540) | O exemplo contém histórico acadêmico com curso, grau e estabelecimento, profissões e mandatos, além de links para proposições, relatorias e votações. | Perfil fora de exercício usado como exemplo documental. Disponibilidade em outros perfis e extração estruturada ainda precisam ser verificadas. |

### Propostas de campanha

Não pressupor que todo candidato ao Congresso tenha um plano de propostas depositado no TSE. A documentação de registro consultada prevê propostas para os cargos de presidente, governador e prefeito. Fonte: [TSE — registro de candidaturas](https://www.tse.jus.br/eleicoes/historia/processo-eleitoral-brasileiro/candidaturas).

Caso haja links de campanha no cadastro, identificá-los como material da candidatura, sem converter automaticamente alegações de campanha em fatos verificados. A primeira implementação pode se limitar aos documentos oficiais já encontrados.

### Patrimônio e contas eleitorais

O DivulgaCandContas também permite consultar bens declarados e informações de arrecadação e despesas. Esses documentos podem ser referenciados no perfil, com eleição e data da consulta. A mera existência de um valor, doação ou alteração patrimonial não sustenta conclusão sobre irregularidade. O primeiro diretório não depende de implementar cruzamentos financeiros.

## O que já existe e o que precisa mudar

- `backend/src/models/DeputyModel.ts:26`: consulta deputados em exercício e organiza seus votos no recorte de 2026; não cobre todas as candidaturas nem todos os ex-deputados.
- `backend/src/models/SenatorModel.ts:14`: consulta senadores em exercício e seu retrospecto de votos; a cobertura precisa continuar explícita.
- `backend/src/models/SenatorModel.ts:12`, `:38` e `:86`: `onBallot` compara o fim do mandato com `2027-01-31`. Esse resultado informa um ciclo de mandato, não candidatura registrada. A interface do Senado também consome o campo.
- `backend/src/routes/deputyRoutes.ts:1`: padrão de rotas públicas de lista e detalhe a seguir.
- `backend/src/utils/officialHttpGet.ts:1`: ponto existente de transporte para novas integrações oficiais, com as particularidades documentadas do Senado. Confirmar suporte às respostas e arquivos do TSE.
- `frontend/app/(dashboard)/camara/DeputadosPanel.tsx:1`: referência de busca, filtros, cards e navegação em registros de uma pessoa; o novo diretório precisa de URL própria por candidatura.
- `frontend/lib/publicRoutes.ts:4`: lista de caminhos públicos; os novos perfis precisam entrar com limite de prefixo correto.

O relatório e manifesto de `graphify-out/` foram consultados como apoio. Os contratos citados foram validados no código-fonte; ainda não foi realizado o levantamento completo de dependências da futura integração.

## Contratos de dados propostos

- **Identidade eleitoral:** eleição + identificador oficial de candidatura. Confirmar a composição exata no dicionário do TSE antes de fixar URLs e armazenamento. Preservar IDs textuais e evitar perda de precisão numérica.
- **Pessoa e mandato:** vínculos separados da candidatura. Não assumir continuidade de identificadores entre eleições nem igualdade com os IDs da Câmara/Senado.
- **Vinculação:** nome semelhante sozinho não basta. Relação confirmada deve carregar evidência; ambiguidades ficam sem associação automática.
- **Procedência:** fonte e data por bloco. Coleta recente não significa que a informação foi atualizada recentemente pelo órgão.
- **Situação eleitoral:** preservar o valor publicado, com data. Não reduzir toda a situação do registro a um booleano de “apto” inferido.
- **Universo da lista:** recursos importados do TSE definem a cobertura. Pessoas sem mandato anterior aparecem normalmente.
- **Ausência e falha:** falha de rede não vira lista vazia nem currículo inexistente. Enriquecimento indisponível não remove a candidatura da lista.
- **Atuação:** votos, autoria, relatoria e mandatos são registros distintos, sempre com fonte e período. Ausência de voto publicado não prova falta injustificada.

Proposta de API a detalhar após confirmar as chaves:

- `GET /candidates?election=...&state=...&office=...&q=...&party=...&status=...&page=...`: lista paginada, total, filtros aplicados, cobertura e datas da fonte.
- `GET /candidates/:id?election=...`: identificação eleitoral, informações curriculares disponíveis, vínculo parlamentar e fontes. O identificador da URL pública deve ser inequívoco entre eleições.

Lista não baixa biografias individualmente para cada card. Consultar/enriquecer detalhes sob demanda e com cache compatível com o ambiente, sem impedir a navegação básica.

## Passo a passo

### Fase 0 — Investigar a fonte para construir o diretório

**Objetivo:** fechar um contrato implementável para os dados eleitorais, não produzir um documento por candidato.

**Contrato travado:** universo de candidaturas vem do TSE; arquivos, chaves e tamanhos ainda não medidos não são tratados como conhecidos.

**Reaproveita:** `backend/src/utils/officialHttpGet.ts:1` e os padrões de modelos consultados. Ler o grafo e os consumidores dos contratos que forem alterados, validando cada referência no código.

1. Inspecionar amostras e dicionários dos recursos de candidatos de 2026: encoding, delimitador, compactação, identificadores, códigos de cargos e situações.
2. Confirmar como distinguir titular e suplentes do Senado para não misturá-los silenciosamente no filtro de cargo.
3. Medir tamanho, tempo de download, processamento e memória; definir cache e atualização a partir dessas evidências, considerando as quedas do WSL.
4. Fixar identidade, rotas, campos, limites de paginação e cobertura inicial. Conferir se a fonte oferece links estáveis de perfil.
5. Registrar descobertas e dificuldades em `execucao-candidatos.md`, com URL, data, reprodução e resultado observado.

**Validação parcial:** uma amostra é lida sem perda de IDs, nomes ou situações; a cobertura é reproduzível e o mecanismo de carga cabe no ambiente. Se exigir banco ou novo processo, detalhar a mudança antes de executá-la.

### Fase 1 — Ingestão e API pública

**Objetivo:** servir candidaturas reais, com filtros e procedência, pela API existente.

**Contrato travado:** lista e perfil independem de autenticação e do fluxo editorial de dossiês; dados sem correspondência parlamentar continuam acessíveis.

**Reaproveita:** `backend/src/routes/deputyRoutes.ts:1` para rotas de leitura e `backend/src/utils/officialHttpGet.ts:1` para a integração oficial.

1. Implementar adaptador TSE, normalização e cache no backend.
2. Implementar modelo, tipos, controller e endpoints de lista/perfil.
3. Validar entrada e limitar paginação; retornar cobertura e datas.
4. Registrar a estratégia de atualização e o comportamento diante de indisponibilidade.

**Cenários obrigatórios:**

| Cenário | Resultado obrigatório |
|---|---|
| Identificador longo e nome com acentos | Preservação sem perda de precisão ou caracteres. |
| Mesmo nome em registros diferentes | Candidaturas distintas, sem fusão pelo nome. |
| Filtros combinados e paginação | Total consistente, ordem estável e cobertura informada. |
| Pessoa sem mandato anterior | Candidatura listada e perfil eleitoral acessível. |
| Arquivo inválido ou fonte indisponível | Erro identificado; não retornar sucesso com universo vazio. |
| IDs de eleições diferentes | Perfil resolvido pela identidade eleitoral completa. |

**Validação parcial:** conferir amostras dos dois cargos contra o TSE e provar que filtros não ocultam registros por falta de biografia.

### Fase 2 — Diretório e perfis dentro do sistema

**Objetivo:** disponibilizar uma experiência navegável de consulta a candidatos.

**Contrato travado:** informações são factuais, com fontes; visitante pode consultar sem conta e compartilhar a URL de um perfil.

**Reaproveita:** `frontend/app/(dashboard)/camara/DeputadosPanel.tsx:1` como referência de interface e `frontend/lib/publicRoutes.ts:4` como ponto de integração pública.

1. Criar páginas de lista e perfil; adicionar a entrada Candidatos no menu.
2. Implementar busca, filtros e paginação com estado na URL para permitir retorno e compartilhamento.
3. Mostrar identificação, escolaridade e ocupação já disponíveis; demais blocos têm estados explícitos de cobertura.
4. Exibir carregamento, erro com nova tentativa e ausência de resultados como estados diferentes.

**Cenários obrigatórios:**

| Cenário | Resultado obrigatório |
|---|---|
| Abrir perfil diretamente sem login | Perfil público carregado pela URL. |
| Filtrar, abrir perfil e voltar | Filtros e página preservados. |
| Busca sem resultados | Mensagem específica, diferente de erro de origem. |
| Fotografia ou escolaridade ausente | Perfil legível, sem informação inventada. |
| Prefixo parecido com rota pública | Nenhuma liberação de caminho não previsto. |

**Validação parcial:** percorrer lista → filtros → perfil → retorno em desktop e celular; conferir navegação por teclado e links oficiais.

### Fase 3 — Currículo disponível e registros parlamentares

**Objetivo:** complementar o perfil com trajetória e atuação documentadas, mantendo a distinção entre candidatura e mandato.

**Contrato travado:** sem associação automática apenas por nome; ausência de cobertura não equivale a ausência de experiência ou atuação.

**Reaproveita:** `backend/src/models/DeputyModel.ts:26` e `backend/src/models/SenatorModel.ts:14` para os registros já disponíveis. Essas consultas limitam-se a parlamentares em exercício; não presumir cobertura de ex-parlamentares.

1. Confirmar disponibilidade e contratos dos endpoints biográficos; usar dados estruturados quando houver e links oficiais quando a extração ainda não estiver implementada.
2. Introduzir vínculo de identidade com evidência e comportamento explícito para casos sem correspondência ou ambíguos.
3. Mostrar formação, atividades e mandatos com fonte e datas, sem prometer currículo completo para todos.
4. Relacionar a atuação já disponível e explicar seu período. Enriquecimento falho não bloqueia a identificação eleitoral.
5. Corrigir o significado de `onBallot` e os leitores identificados: ciclo de mandato permanece distinto da candidatura confirmada no TSE.

**Cenários obrigatórios:**

| Cenário | Resultado obrigatório |
|---|---|
| Homônimo ou vínculo ambíguo | Nenhum voto ou currículo atribuído à pessoa errada. |
| Ex-parlamentar fora da cobertura atual | Limitação explícita; não exibir atuação total igual a zero. |
| Mandato terminando sem confirmação no TSE | Não afirmar candidatura com base no término. |
| Informação divergente em duas fontes | Fonte e data preservadas, sem escolha silenciosa. |
| Fonte biográfica indisponível | Identificação eleitoral continua acessível. |

**Validação parcial:** verificar vínculos e informação curricular diretamente nas fontes; atualizar o mapa conforme adaptadores efetivamente necessários.

## Fase final — Validar o diretório

- Conferir contagens e cobertura do recorte importado, nome, número, cargo, UF, partido e situação contra a fonte.
- Verificar candidatos com e sem mandato, homônimos, ex-parlamentares e lacunas curriculares.
- Confirmar que links, URL do perfil e retorno aos filtros funcionam sem login.
- Validar paginação, acessibilidade e falhas parciais sem congelar a navegação.
- Rodar testes focados pertinentes à implementação, sem suíte completa. Depois executar lint por workspace e deixar os typechecks ao fim, conforme orientação do usuário; build conforme mudanças e condições do ambiente.
- Validar que a atualização da fonte não confunde candidatura com mandato nem faz desaparecer silenciosamente situações eleitorais.
- Registrar evidências, limites ainda existentes e o que foi de fato implementado.

Esta revisão altera somente o plano; não requer iniciar servidores ou rodar testes da aplicação.

## Dossiê posterior — resultado da experiência de implementação

Durante todas as fases, manter um registro técnico enxuto contendo:

| Item | O que registrar |
|---|---|
| Acesso | Fonte, endpoint/recurso, data, resposta observada e como reproduzir. |
| Leitura | Encoding, arquivos, tamanhos, atualização e problemas de parsing. |
| Identidade | Chaves disponíveis, ambiguidades entre órgãos e solução adotada. |
| Cobertura | Campos ausentes, perfis incompletos, limites do histórico e exemplos documentados. |
| Operação | Tempo/memória medidos, falhas de origem e comportamento do cache. |
| Produto | Informação que conseguimos mostrar no diretório e o que ainda não conseguimos sustentar com os dados. |

**Só depois dessas observações**, consolidar o dossiê sobre acesso aos dados de candidatos e integração entre TSE, Câmara e Senado. O texto deve explicar o que os dados oferecem, as dificuldades encontradas e o caminho técnico reproduzível. O fluxo de dossiês e o PDF já existente serão usados nessa etapa posterior, sem virar dependência do diretório.

## Fora da primeira entrega e decisões abertas

Fora da primeira entrega: geração de dossiês/PDF, editor manual por candidato, ranking ou nota, recomendação eleitoral, personalização política, ingestão de redes sociais e novas fontes legislativas estaduais.

A fechar na fase 0: identificadores efetivos, formato/volume da origem, estratégia de cache, política de atualização, tratamento dos suplentes e cobertura nacional disponível. A presença de informação curricular incompleta não deve bloquear a lista de candidaturas.
