---
name: "<NOME_DO_DIAGRAMA>"
overview: "<RESUMO_EM_1_2_LINHAS_DO_QUE_O_DIAGRAMA_MOSTRA>"
todos: []
isProject: false
---

# Diagrama: estado atual vs. desejado — `<SUBSISTEMA>`

> Use este template quando o foco é **comunicar visualmente** uma mudança arquitetural — antes/depois em ASCII, com componentes, responsabilidades e contratos claros. Pode ser usado isolado ou colado dentro de um plano maior (seção 2 do `arquitetura-desejada.template.md`).

---

## Convenções de notação

Use estas marcações nos diagramas para deixar o estado de cada componente óbvio:

- `(existente)` — arquivo/módulo que já existe e permanece
- `(existente — ganha X)` — arquivo já existe e ganha responsabilidade nova
- `(existente — perde X)` — arquivo já existe e tem responsabilidade removida
- `✨ NOVO` — arquivo/módulo a ser criado
- `✂ DELETADO` — arquivo/módulo a ser removido
- `◄──` — anotação inline apontando algo importante na linha anterior
- `├─` / `└─` — listagem de responsabilidades/métodos do componente acima
- Caixa com `┌─┐ │ └─┘` — destaque para contratos de API ou fluxos importantes

---

## Atual

```text
<ENTRADA_OU_GATILHO>           (ex: usuário, evento, webhook, dado externo)
     │
     │ <protocolo_ou_dado_que_passa>
     ▼
<COMPONENTE_1>                 (existente — caminho/arquivo)
     │
     │ <o_que_ele_produz_ou_chama>
     ▼
<COMPONENTE_2>                 (existente — observação se relevante)
     │
     ├─── <responsabilidade_1>                      ┐
     ├─── <responsabilidade_2>                      │ <PADRÃO_PROBLEMÁTICO>
     ├─── <responsabilidade_3>                      │ (ex: AGREGAÇÃO LOCAL,
     └─── <responsabilidade_4>                      ┘  PARSING DUPLICADO)
     │
     ├──► <COMPONENTE_3>
     │    └─ <o_que_faz_aqui>
     │
     ├──► <COMPONENTE_4>
     │    └─ <o_que_faz_aqui>
     │
     │ <chamada_de_API_ou_evento>
     ▼
<COMPONENTE_BACKEND>           (existente)
     │
     ├─ <responsabilidade_1>                        ┐
     ├─ <responsabilidade_2>                        │ MESMA <coisa>
     └─ <responsabilidade_3>                        ┘ feita do zero
     │
     │ <retorno>
     ▼
<COMPONENTE_FINAL>             (existente)
     │ <observação_sobre_limitação_atual>
```

---

## Desejado

```text
<ENTRADA_OU_GATILHO>
     │
     │ <protocolo_ou_dado_que_passa>
     ▼
<COMPONENTE_1>                                  (existente — ganha 1 handler)
     │   └─ <novoMetodo>()  ◄── handler novo (~<N> linhas, <papel>)
     │       1. <passo_1>
     │       2. <passo_2>
     │       3. <passo_3>  → chama <SERVICE_NOVO>
     │       4. <passo_4>
     │
     │ chama:
     ▼
<SERVICE_NOVO_1>                                ✨ NOVO — <papel> (~<N> linhas)
         ├─ <funcao_publica>(<args>)
         │     ├─ se <condicao_a> → retorna <forma_a>      (modo raw)
         │     └─ se <condicao_b> → retorna <forma_b>      (modo normalized)
         │
         ├─ <helper_1>()                <comentario_curto>
         ├─ <helper_2>()                <comentario_curto>
         └─ <helper_3>()                chama <SERVICE_NOVO_2>

<SERVICE_NOVO_2>                                ✨ NOVO — <papel> isolado
         ├─ <funcao_1>()
         ├─ <funcao_2>()
         └─ <funcao_3>()
            (<quem_consome_estes_helpers>; sem import circular)

<MODELO_OU_REPO>                                (existente — <metodo> ganha <coisa>)
         └─ <operação_de_persistência>           ✨ (<tabela_nova>?)
            + <atualização_complementar>

<TIPOS>                                         (existente — ganha tipos)
         ├─ <Tipo1>
         ├─ <Tipo2>                              ◄── <papel>
         └─ <Tipo3>                              ◄── <papel>

<ROTAS>                                         (existente — registra rota nova)
         └─ <METODO> /<rota/nova>

     ┌─────────────────────────────────────────────────────────────────┐
     │ Endpoint único: <METODO> /<rota>                                │
     │   body: { <campos_principais> }                                 │
     │   ─ <condicao_a>:  <forma_de_resposta_a>      (raw)             │
     │   ─ <condicao_b>:  <forma_de_resposta_b>      (normalized)      │
     │                                                                 │
     │ Endpoint existente: <METODO> /<rota_atual>                      │
     │   contrato novo: { <campos_atualizados> }                       │
     │   → <retorno>   (igual ao de hoje | com novidade X)             │
     └─────────────────────────────────────────────────────────────────┘

     ▼
<COMPONENTE_FRONT_OU_CONSUMIDOR>                (existente — perde código)
     │   ─ <fluxo_a> usa <modo_a>     (<comportamento_correspondente>)
     │   ─ <fluxo_b> usa <modo_b>     (<comportamento_correspondente>)
     │   sem <antipadrão_1>, sem <antipadrão_2>
     │
     ├──► <NOVO_MODULO_DERIVADO>                 (NOVO — <fase_correspondente>)
     │     ├─ <funcao_pura_1>(<args>)
     │     ├─ <funcao_pura_2>(<args>)
     │     └─ <funcao_pura_3>(<args>)
     │
     ├──► <COMPONENTE_FILHO_1>                   (existente — usa <novidade>)
     │     └─ <o_que_muda_aqui>
     │
     └──► <COMPONENTE_FILHO_2>                   (existente — sem mudança estrutural)
          └─ <comportamento_que_permanece>
```

---

## Diferenças-chave

- **<eixo_1> (ex: ownership da agregação):** <antes_em_1_linha> → <depois_em_1_linha>
- **<eixo_2> (ex: contrato do endpoint):** <antes> → <depois>
- **<eixo_3> (ex: persistência):** <antes> → <depois>
- **<eixo_4> (ex: deduplicação):** <antes> → <depois>
- **<eixo_5> (ex: número de linhas/arquivos tocados):** <antes> → <depois>

---

## Deleções (opcional)

Código/arquivos que viram morto após esta mudança:

- `<arquivo_ou_funcao_1>` — <motivo_curto>
- `<arquivo_ou_funcao_2>` — <motivo_curto>
- `<arquivo_ou_funcao_3>` — <motivo_curto>

---

## Dicas de uso

1. **Mantenha o ASCII consistente.** Use sempre os mesmos caracteres (`│`, `├`, `└`, `▼`, `◄──`) — facilita ler em monospace.
2. **Anote o status de cada caixa.** Sem `(existente)` / `✨ NOVO` o leitor não sabe o que é trabalho novo vs. estado atual.
3. **Comentários inline > legendas separadas.** Coloque `◄── papel` ou `# motivo` na mesma linha do componente; evita o ping-pong de "ver legenda abaixo".
4. **Caixas só pra contratos importantes.** Use `┌─┐` para destacar contratos de endpoint ou regras críticas — não abuse, perde força.
5. **Mostre fluxos paralelos.** Se um componente alimenta vários outros, use `├──►` repetidamente em vez de transformar tudo em texto.
6. **Conte linhas/arquivos só quando relevante.** "(~250 linhas)" ajuda a calibrar tamanho do trabalho; "(1442 linhas)" ajuda a justificar uma quebra. Não ponha em todo lugar.
