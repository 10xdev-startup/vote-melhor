---
name: commit
description: "Fluxo padrao para organizar commits e push com quality gate integrado. Use quando o usuario pedir para commitar, subir, ou fazer push."
---

# Git Commit & Push Workflow

**Nunca commite automaticamente.** So commite quando o usuario pedir explicitamente (ex: "commita", "pode subir", "sobe", "commit", "push").
Quando o usuario pedir, siga este fluxo. Se pedir para pular o quality gate ("pula", "skip", "so commita"), va direto para a etapa 3.

## 1. Analisar alteracoes pendentes

- Rode `git status` e `git diff --stat` para listar todos os arquivos modificados
- Rode `git diff` por grupo de arquivos para entender cada mudanca

## 2. Quality Gate (rodado PELO DEV)

**O agente nao roda `typecheck`, `lint` nem `build` neste repo** — o WSL do dev trava (ver
"Comandos" no `CLAUDE.md`). Liste os comandos junto da tabela e aguarde o retorno colado.

```bash
npm run typecheck -w backend && npm run lint -w backend
npm run typecheck -w frontend && npm run lint -w frontend
```

- **Sempre pedido**, independente do tamanho da mudanca. Se falhar, corrija e peca de novo.
  Nao prossiga ate passar.
- `npm run build` so quando o dev pedir, ou quando a mudanca tocar `types/`, `tsconfig`,
  `package.json` ou config de build.

O agente roda apenas testes Jest **filtrados por arquivo**, que sao leves:
`npm test -w backend -- <arquivo>` / `npm test -w frontend -- <arquivo>`, ou `-- -o` para
os afetados pelo diff. **Nunca** a suite inteira sem filtro.

## 3. Organizar pela ordem do Mapa de arquivos

Esta skill e a fonte do padrao de organizacao, titulos e tabelas de commits. O objetivo e localizar as mudancas por feature e area no historico do Git.

- Use arquivos inteiros, sem hunks ou `git add -p`. Cada caminho entra em um unico commit do lote; inclua arquivos novos e remocoes, e confira que nenhum caminho autorizado ficou de fora.
- Siga os grupos e a ordem do Mapa de arquivos: backend rotas e controllers; backend services; backend models e types; backend testes; frontend componentes; frontend hooks; frontend services, lib e types; frontend testes; documentacao e padrao dos planos. Omita grupos sem diff e adapte os caminhos ao projeto.
- Os commits da mesma entrega formam um lote para o mesmo push. Nao reorganize automaticamente por funcionalidade nem divida trechos para tornar cada commit independente. Declare dependencias entre grupos e valide o conjunto final.
- Quando um arquivo inteiro incluir mais de um efeito (ex.: campanhas e arquivamento), descreva ambos no corpo do commit. Mudancas de outra entrega so entram se fizerem parte do escopo autorizado.
- DDL aplicado via Management API fica registrado na documentacao; nao crie migration `.sql` nem commit vazio para representar o bloco Supabase do mapa.

### Titulos do lote de uma feature

Formato obrigatorio: `feat(<nome-da-feature>): <area do mapa> - <mudanca concreta>`.

- Todos os commits do lote usam o mesmo prefixo `feat(<nome-da-feature>):`, inclusive testes, hooks e documentacao. Nao trocar por `test`, `refactor` ou `docs` nesses grupos.
- O texto entre parenteses identifica a feature, nao a camada. Defina-o uma vez e preserve em todo o lote; `acesso-publico` e o exemplo desta entrega, nao um nome fixo para futuras features.
- A area faz parte do titulo real do commit, nao apenas do rotulo junto da numeracao na tabela. Ex.: `backend rotas e controllers`, `frontend hooks` e `documentacao e padrao dos planos`.
- Depois de ` - `, diga o efeito de forma concreta. Nao acrescente "refactor" ao titulo dos hooks apenas porque houve extracao de codigo.

Exemplos aprovados:
- `feat(acesso-publico): backend rotas e controllers - abre a leitura dos dados factuais`
- `feat(acesso-publico): frontend services, lib e types - move a decisao de rota publica`
- `feat(acesso-publico): frontend testes - cobre rota publica e vazamento por prefixo`

## 4. Apresentar commits para aprovacao

Uma tabela por commit, separadas por `---`. Tres linhas cada: titulo, descricao,
arquivos. O formato existe pra o usuario escanear a coluna da esquerda e decidir
sem abrir diff — nao junte tudo numa tabela unica, a separacao e o que torna
legivel com 8 commits na tela.

```markdown
| **#1** | `feat(acesso-publico): backend rotas e controllers - abre a leitura dos dados factuais` |
|:---|:---|
| **Descricao** | O que muda e POR QUE, em 1-3 frases. Nomeie o efeito real, nao o arquivo. |
| **Arquivos** | `arquivo1` · `arquivo2` · testes `x` · `y` |

---

| **#2** | `feat(acesso-publico): frontend testes - cobre rota publica e vazamento por prefixo` |
|:---|:---|
| **Descricao** | ... |
| **Arquivos** | ... |
```

Regras da tabela:
- Separe cada commit com `---`; sem isso as tabelas colam e viram uma parede.
- **Arquivos**: separador `·`, sem caminho completo repetido. Agrupe por pasta
  quando forem muitos (`backend/src/models/` → `a`, `b`, `c`). Informe a quantidade
  de caminhos e confira a lista contra o diff; arquivos sem alteracao nao entram.
- **Descricao**: sera o corpo do commit; preserve o texto aprovado. Diga o efeito, nao o inventario. "Corrige X, que fazia Y" vale
  mais que "altera A, B e C".
- Se um commit carregar duas responsabilidades por limite de arquivo inteiro,
  **diga isso na descricao** em vez de esconder.

Depois da tabela, liste fora dela o que exigir decisao: ordem obrigatoria entre
commits, bug conhecido subindo junto, quality gate que nao pode rodar.

Aguarde o "ok" do usuario antes de executar os commits.

## 5. Executar commits na ordem

Cada commit usa HEREDOC com titulo + corpo descritivo:

```bash
git add arquivo1 arquivo2 && git commit -m "$(cat <<'EOF'
feat(acesso-publico): frontend testes - cobre rota publica e vazamento por prefixo

Descricao detalhada em 2-3 linhas explicando
o que foi feito e o motivo da alteracao.
EOF
)"
```

## 6. Verificar e fazer push

- Rode `git status` + `git log --oneline` para confirmar
- **Faca o push automaticamente** logo apos os commits
- Sempre perguntar antes de fazer `push --force`

## Regras

- Titulos de commit em **portugues**, lowercase, sem ponto final
- Corpo do commit em **portugues** com contexto util
- Titulos devem ser descritivos e concisos. ~72 caracteres e referencia, nao limite que justifique remover a area ou alterar o prefixo aprovado.
- Na execucao, use o titulo completo e a descricao aprovados nas tabelas; a numeracao `#1`, `#2` pertence so a apresentacao.
- Sempre perguntar antes de fazer `push --force`

**Fora de um lote de feature:** mudancas independentes podem usar `fix`, `perf`, `style`, `refactor`, `docs`, `chore` ou `test`, conforme o trabalho. Dentro do lote, prevalece o prefixo unico definido na etapa 3.
