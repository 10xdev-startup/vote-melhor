---
name: 10x-inicio-projeto
description: Conduzir um projeto 10x do briefing ao primeiro deploy a partir do template Node.js, Express, Next.js e Supabase. Usar ao iniciar, clonar, rebatizar ou estruturar um produto novo; criar a fundacao de banco e autenticacao; definir recursos, rotas e navegacao; evitar UI generica ou arquivo-deus; preparar ambiente local e Azure; ou quando o usuario pedir para colocar um MVP completo no ar rapidamente. A skill entrevista o usuario, recomenda defaults quando houver duvida e aplica gates de arquitetura, UX, seguranca e qualidade antes de mutar Supabase, Stripe ou producao.
---

# 10x Inicio de Projeto

Levar o template a um primeiro fluxo vertical utilizavel em ate 30 minutos. Tratar 30
minutos como meta de foco, nunca como permissao para pular seguranca ou validacao.

## Regras de condução

1. Conversar em portugues; escrever codigo em ingles.
2. Pensar antes de codar. Nao assumir decisao material nem esconder incerteza.
3. Quando o usuario estiver em duvida, recomendar um default, explicar impacto em uma
   frase e pedir confirmacao somente se a escolha mudar banco, auth, custo ou deploy.
4. Preferir a solucao minima que entrega o primeiro fluxo real. Nao criar flexibilidade
   especulativa, integrações ou tabelas sem caso de uso do briefing.
5. Corrigir atrito recorrente na fonte: template, script, env, referencia ou skill.
6. Manter mudancas rastreaveis a uma decisao do briefing e a um criterio verificavel.

## Fluxo obrigatório

Antes de executar, ler [references/ecossistema-skills.md](references/ecossistema-skills.md).
Esta skill orquestra os playbooks existentes; nao copiar nem resumir suas regras dentro da
implementacao. Respeitar skills `MANUAL TRIGGER ONLY` e gates de aprovacao.

### 1. Descobrir antes de gerar

Ler [references/descoberta.md](references/descoberta.md). Fazer a entrevista em blocos
curtos; nao despejar um questionario tecnico. Reformular o produto em uma frase e obter
alinhamento sobre:

- usuario, problema e resultado principal;
- nome, slug e idioma;
- recursos e rotas;
- acesso publico, autenticado ou administrativo;
- ownership individual por `user_id`;
- integracoes, dados sensiveis, billing e deploy;
- primeiro fluxo vertical e nao-objetivos.

Registrar as decisoes no plano em `.cursor/plans/fazendo/`. Se algo ainda estiver aberto,
registrar `pendente`, o default recomendado e o que fica bloqueado; nao inventar.

Antes de mutar o repositorio, confirmar o escopo desta execucao: editar arquivos, instalar
dependencias, subir servidores locais, criar commit, enviar branch e publicar sao permissoes
separadas. O default e somente editar e validar estaticamente o que o usuario pediu.

### 2. Fazer preflight do clone

Ler [references/roteiro-30-minutos.md](references/roteiro-30-minutos.md) e executar:

```bash
node .claude/skills/10x-inicio-projeto/scripts/validate-project.mjs --mode template
npm ci
```

Usar um unico `package-lock.json` na raiz. Nunca manter lockfiles nos workspaces. Confirmar
Node compativel, worktree conhecido, envs de exemplo e portas 3000/3001 livres.

Apresentar as variaveis exigidas pelo fluxo escolhido antes de criar envs locais. A base usa:

- frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- backend: `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
  `SUPABASE_PROJECT_REF` e `SUPABASE_ACCESS_TOKEN`.

Perguntar quais valores ja estao disponiveis e orientar o usuario a grava-los em
`frontend/.env.local` e `backend/.env`. Nunca pedir que segredos sejam expostos no chat, nunca
copiar valor entre produtos e nunca inventar placeholder como se fosse credencial valida.

### 3. Fixar arquitetura e mapa de telas

Ler [references/arquitetura-qualidade.md](references/arquitetura-qualidade.md). Antes de
componentes, escrever o mapa `recurso -> rota -> objetivo -> estado vazio/loading/erro`.

- Cada item da sidebar deve apontar para uma rota real e distinta.
- Dashboard resume; nao absorve CRUD, configuracao, perfil e historico numa aba unica.
- Backend segue Routes -> Controller -> Model -> Database. Apenas Model acessa Supabase.
- Frontend usa `services/` para HTTP, `types/` para contratos e `lib/` para utilitarios.
- Next.js 16 usa `frontend/proxy.ts`. Nunca renomear `backend/src/middleware/`.

### 4. Preparar Supabase com contrato explícito

Ler [references/supabase-foundation.md](references/supabase-foundation.md) e invocar `$supabase`
para a passagem de fundacao. A fundacao inicial deve conter apenas `users`. Tabelas de dominio
nascem depois a partir do briefing. A skill `supabase` e dona do SQL e da operacao administrativa.

Antes de aplicar DDL:

1. Mostrar tabelas, ownership, uniques, FKs, deletes, indices e policies.
2. Deixar `$supabase` executar em transacao com `rollback` para validar.
3. Pedir aprovacao para aplicar no projeto Supabase resolvido pelo `project_ref`.
4. Aplicar pela Management API/SQL Editor; nao criar migration `.sql` no repositorio.
5. Auditar RLS, grants, constraints e acesso anonimo depois da aplicacao.

`user_id` vem de `req.user`/`auth.uid()`, nunca do body. Service role nao elimina a
obrigacao de filtrar por owner em toda query privada.

### 5. Entregar um fluxo vertical

Implementar uma fatia completa, nao varias telas cenograficas:

```text
rota -> controller -> model -> tabela/RLS -> service frontend -> tela -> estados -> teste
```

Reusar o envelope `sendOk`/`sendError`, `AppError`, `apiClient`, auth e componentes do
template. Customizar nome, texto, navegacao, tokens e primeira tela; nao deixar “Meu
Projeto”, vitrine ou copy do template como produto final.

### 6. Tratar Stripe como módulo opcional

Somente se billing fizer parte do briefing, ler `../stripe-setup/SKILL.md`. Começar em test
mode e auditoria read-only. Em conta compartilhada, exigir namespace e metadata do produto.
Nao criar meter, rate card, webhook, checkout live ou Customer sem decisao financeira e
aprovacao explícita. Stripe nao e requisito do bootstrap base.

### 7. Validar e publicar

Executar:

```bash
node .claude/skills/10x-inicio-projeto/scripts/validate-project.mjs --mode project
npm run typecheck
npm run lint
```

Rodar apenas testes relacionados ao diff. Subir `npm run dev`, verificar frontend 3000,
backend 3001, auth, uma rota protegida, um CRUD owner-scoped e um erro.

Como ultimo gate local, executar o checklist completo do plano e apresentar uma tabela
`verificacao -> evidencia -> status`. Incluir worktree/branch, diff e segredos, validador do
bootstrap, testes pertinentes, typecheck, lint, build, smoke do fluxo vertical, auth, ownership,
erros, Docker/workflow e `$supabase` em modo auditoria. Qualquer falha bloqueia o deploy.

Somente com todos os gates aprovados, perguntar: “Quer partir para o deploy na Azure agora? A
skill vai ler as variaveis de `backend/.env` e `frontend/.env.local` sem mostrar os valores,
apresentar os recursos e custos escolhidos e pedir um novo OK antes de executar a Azure CLI.”
Invocar `deploy-azure` apenas se o usuario responder sim. Uma resposta negativa encerra o
bootstrap local sem publicar nada.

## Gates de conclusão

Nao declarar pronto enquanto algum item falhar:

- briefing e nao-objetivos registrados;
- `npm run dev` sobe frontend e backend juntos;
- uma pagina distinta por recurso de navegacao;
- nenhuma tabela privada sem RLS/ownership;
- nenhum DB call em controller/route;
- nenhuma resposta Express crua fora do envelope;
- nenhum segredo, `.env` real ou ID live versionado;
- auth usa `frontend/proxy.ts` e redirect interno validado;
- telas cobrem vazio, loading, erro e sucesso;
- sem arquivo-deus ou componente monolitico sem justificativa;
- testes focados, typecheck, lint e smoke local passam;
- mutacoes externas e deploy foram aprovados.
- `$supabase` criou/validou `users` e concluiu a auditoria final, ou o bloqueio por credencial
  ausente foi registrado sem alegar banco pronto;
- skills especializadas aplicaveis foram executadas ou dispensadas com motivo registrado.

## Aprendizado acumulado

Para entender por que os gates existem, consultar
[references/licoes-10xvagas.md](references/licoes-10xvagas.md). Nao copiar o dominio de
vagas; reaproveitar apenas os padrões e as correções de processo.
