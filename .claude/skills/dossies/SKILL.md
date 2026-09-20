---
name: dossies
description: Escreve e envia dossiês da Vote Melhor como rascunhos, a partir de Markdown local com fontes oficiais e referências de código. Use quando o usuário pedir um dossiê sobre uma integração, documentar aprendizados ou atualizar um dossiê existente.
---

# Dossiês da Vote Melhor

Escreva Markdown local e use `backend/scripts/push-dossier.mjs` da raiz do repositório. O script usa a API existente com JWT do Supabase, seguindo o fluxo da upload-to-10xdev. Não use service-role no script e não grave diretamente no banco.

## Autoria

1. Leia o código e a investigação. Escolha um commit existente com SHA completo e confira os arquivos nesse commit. Alterações locais não pertencem a esse SHA: descreva-as separadamente, sem apresentá-las como já implementadas nele.
2. Use título descritivo, como “VoteMelhor — Analisando os dados do Senado”, sem suspense, clickbait ou sugestão de irregularidade. Apresente o escopo e o caminho técnico. Abra com aprendizados concretos sobre os dados: o que aprendemos ao acessá-los, o que há de útil e quais perguntas ajudam a responder. Traga exemplos com fontes próximas; números históricos devem informar data e recorte. Diferencie possibilidades dos dados e funcionalidades já implementadas. Só depois explique origem, percurso técnico, dificuldades, solução, limitações e como contribuir. Neutralidade política; nenhuma inferência apresentada como fato.
3. Cite URLs oficiais perto das afirmações. Links do código devem conter o SHA. Diferencie medições históricas, testes com mocks e verificação real de hoje. Não invente data de coleta.
4. Mantenha rascunhos fora do Git. Use diretório privado externo ou `.local/dossiers/` (ignorado). Markdown simples, sem frontmatter: títulos, ênfase, listas, citações, links HTTP(S), tabelas e blocos de código. Sem HTML ativo, imagens ou Mermaid. Diagramas ASCII/box-drawing em blocos de código.
5. Use tabelas estreitas (até seis colunas), células curtas e diagramas de até aproximadamente 90 caracteres por linha. O exportador mede a fonte e recusa conteúdo que não caiba, em vez de cortar. Confira todas as páginas da prévia.

## Envio

```bash
node backend/scripts/push-dossier.mjs /caminho/privado/senado.md \
  --slug senado-acesso-aos-dados \
  --title 'Como acessamos os dados do Senado' \
  --source-id senado-receitas-proprias \
  --code-commit <sha-completo> --dry-run
```

`--source-id` é opcional. Use um id de conjunto de `GET /data-sources`; a API valida sua existência. O dry-run valida arquivo, flags, UTF-8, tamanho e commit sem rede. Ele não comprova autorização nem existência da fonte remota.

Remova `--dry-run` para enviar. `API_URL` e `BEARER_TOKEN` devem vir do ambiente, nunca de texto versionado ou argumento de shell. A conta autora é uma conta comum cujo UUID está em `DOSSIER_AUTHOR_USER_ID` no backend. O JWT é uma sessão normal e expira; 401 exige renovação. Não imprima tokens, senhas ou conteúdo integral do rascunho em logs.

O script retorna `/admin/dossies/<slug>`. Mesmo slug substitui somente o rascunho; a publicação atual permanece intacta. Não há histórico nem recuperação de versões antigas. Após timeout, reenviar o mesmo slug não duplica o documento.

O leitor web e o PDF mostram o repositório e o comando de clone logo abaixo do título. Mantenha o SHA nas referências técnicas ao final, distinguindo o commit analisado do código atual obtido pelo clone. Não exponha URLs de localhost no PDF.

## Revisão

Entregue ao usuário o caminho privado, fontes e limites da validação. O administrador abre o rascunho, confere conteúdo e PDF, marca a confirmação e publica na interface. Envio não é publicação. Nunca publique automaticamente por ter concluído a autoria. Conflito 409 exige recarregar e revisar o novo rascunho.
