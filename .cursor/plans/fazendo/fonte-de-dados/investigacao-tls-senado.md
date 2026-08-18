---
name: investigacao-tls-senado
overview: Por que o backend baixa os arquivos do Senado com node:https e TLS 1.2 fixo em vez do fetch global.
todos: []
isProject: false
---

# `Handshake TLS travando com www.senado.gov.br`

> **Leia antes de "limpar" o `maxVersion: 'TLSv1.2'` de `backend/src/utils/officialHttpGet.ts`.**
> Aquilo nao e sobra de debug: e o unico motivo de o preview e da API do Senado funcionarem.

---

## Sintoma

O preview da Fonte de dados falhava sempre, com `O site do orgao nao respondeu`. No backend:

```
TypeError: fetch failed
cause: UND_ERR_CONNECT_TIMEOUT
```

Sempre por volta de **10,5s** — o `connectTimeout` default do undici e 10s. O mesmo arquivo
baixava por `curl` em **~0,4s**.

Reproduzido de forma identica em duas maquinas independentes (WSL2 e um container Linux),
ambas Node **v22.20.0**. Nao era ambiente.

Arquivo usado nos testes:
`https://www.senado.gov.br/bi-arqs/Arquimedes/Financeiro/ReceitasSenado.csv`

---

## O que a investigacao ELIMINOU

Cada linha abaixo foi medida, nao suposta:

| Hipotese | Como caiu |
| --- | --- |
| Site fora do ar | `curl -sI` devolve `HTTP/2 200` em ~0,42s |
| Node sem `fetch` | Node 22 tem `fetch` global |
| Servidor exige HTTP/2 | `curl --http1.1` devolve `HTTP/1.1 200 OK` |
| IPv6 / Happy Eyeballs | `dns.lookup({ all: true })` devolve so `201.54.48.105` (IPv4) |
| Proxy | Nenhuma variavel de proxy no ambiente |
| Bloqueio de rede ao processo Node | `net.connect('201.54.48.105', 443)` conecta |
| Intermitencia | 3 tentativas seguidas, todas ~10,5s |

Por isso **nao adianta** mexer em `--no-network-family-autoselection`,
`--dns-result-order=ipv4first`, `autoSelectFamily: false` nem `allowH2: true`. Nenhum ataca a
causa.

---

## Onde o problema estava

`net.connect` puro conectava, mas `tls.connect()` do Node **ficava pendurado** — ou seja, o
TCP fechava e o handshake TLS nao concluia. Foi por isso que o erro enganou: o nome
`UND_ERR_CONNECT_TIMEOUT` sugere falha de socket, mas o "connect" do undici **engloba o
handshake TLS**.

Fixando a versao maxima do TLS, o handshake completa:

| Configuracao | Resultado |
| --- | --- |
| `tls.connect()` default | pendura |
| TLS 1.3 | pendura |
| Sem ALPN | pendura |
| ALPN `h2` + `http/1.1` | pendura |
| **TLS 1.2** | **handshake conclui** |
| TLS 1.2 + HTTP/1.1 | ~316 ms |
| `fetch()` com `node --tls-max-v1.2` | HTTP 200, 226.922 bytes, ~323 ms |
| Implementacao final (`node:https`) | HTTP 200, 226.922 bytes, ~473–621 ms |

O servidor negocia `TLSv1.2 / ECDHE-RSA-AES256-GCM-SHA384`. O `curl` tambem termina em
TLS 1.2 com esse host.

### Teste minimo que reproduz e confirma

```bash
node --tls-max-v1.2 -e "
const started = Date.now();
fetch('https://www.senado.gov.br/bi-arqs/Arquimedes/Financeiro/ReceitasSenado.csv')
  .then(async response => console.log({
    ms: Date.now() - started,
    status: response.status,
    bytes: (await response.arrayBuffer()).byteLength,
  }))
  .catch(console.error);
"
# { ms: 323, status: 200, bytes: 226922 }
```

Sem a flag, o mesmo comando estoura em ~10,5s.

---

## O que continua DESCONHECIDO

**Nao sabemos qual caracteristica do ClientHello e rejeitada.** Isso importa, porque a
conclusao facil esta errada:

- ❌ "O Senado nao suporta TLS 1.3" — o `curl` tambem oferece TLS 1.3 nesse host e recebe
  downgrade para 1.2 normalmente. Se fosse so falta de suporte, o Node negociaria igual.
- ✅ O que esta provado: o ClientHello padrao do Node/OpenSSL **nao recebe conclusao**; o
  ClientHello gerado com `maxVersion: 'TLSv1.2'` **funciona**; e a falha esta na fase TLS,
  nao em TCP, DNS ou HTTP.

A diferenca especifica (qual extensao, ordem de cipher suites, tamanho do ClientHello) nao
foi isolada. Isolar exigiria capturar e comparar os dois ClientHello no fio.

---

## Hosts afetados (medidos)

O problema **nao e de um host so** — foi encontrado tres vezes, e a suposicao de que um host
novo estava livre ja custou uma investigacao repetida:

| Host | Sintoma sem flag | Com TLS 1.2 |
| --- | --- | --- |
| `www.senado.gov.br` | `UND_ERR_CONNECT_TIMEOUT` ~10,5s | 200 em ~0,3s |
| `www12.senado.leg.br` | idem | idem |
| `legis.senado.leg.br` (API de dados abertos) | idem, 3/3 tentativas | 200 em ~0,3s |

**Nao presuma pelo dominio.** `dadosabertos.camara.leg.br` responde normal com `fetch` global
(200 em ~1,3s), entao o problema nao e "governo brasileiro" nem ".leg.br" — e daquele
balanceador. Meça o host novo com o teste minimo antes de adiciona-lo.

O `fetchSenado` chegou a documentar que `legis.senado.leg.br` "fecha handshake TLS 1.3
normalmente (~0,35s)" e por isso usava `fetch` global. A medicao desmentiu: 3/3 estouram. A
licao pratica e que **a lista de hosts afetados so cresce por medicao, e so encolhe por
medicao**.

---

## Solucao adotada

`backend/src/utils/officialHttpGet.ts` — **um unico ponto** que conhece as peculiaridades de
transporte das origens oficiais, com **`node:https`** em vez de `fetch`. Usado pelo
`fetchSourceFile` (arquivos do catalogo) e pelo `fetchSenado` (API de dados abertos).

Centralizar nao foi preferencia de estilo: enquanto cada cliente carregava a propria decisao
de transporte, um deles documentou o oposto do que a medicao mostrava e passou meses
quebrado em silencio.

Alem do TLS, o `officialHttpGet` trata **redirect**: `node:https` nao segue sozinho, e varios
endpoints do Senado respondem 301 para um JSON estatico — sem seguir, o corpo volta vazio e o
parser acusa erro de formato.

Por que `node:https` e nao a dependencia `undici`:

- API nativa e estavel, sem dependencia nova;
- funciona em Node 20 e 22, e na imagem `node:20-alpine` do deploy;
- deixa configurar `maxVersion` direto na request.

O downgrade e **por host**, nunca global:

```ts
const TLS_1_2_ONLY_HOSTS = new Set(['www.senado.gov.br', 'www12.senado.leg.br', 'legis.senado.leg.br'])

if (TLS_1_2_ONLY_HOSTS.has(parsedUrl.hostname)) {
  requestOptions.maxVersion = 'TLSv1.2'
}
```

Todo host fora dessa lista — `dadosabertos.camara.leg.br` inclusive — segue com negociacao
padrao, TLS 1.3 incluso.

---

## Decisoes que NAO devem ser desfeitas sem novo teste

1. **Nao desabilitar TLS 1.3 no processo todo.** Nada de `NODE_OPTIONS=--tls-max-v1.2` em
   producao: isso rebaixaria todas as conexoes do backend, inclusive Supabase e Stripe.
2. **Manter o downgrade restrito ao host afetado.** Adicionar host novo a
   `TLS_1_2_ONLY_HOSTS` exige medir aquele host antes.
3. **Nao "resolver" aumentando o timeout.** O handshake pendura; esperar mais so troca 10s
   por 30s de espera antes do mesmo erro.
4. **Nao habilitar `allowH2`.** O host serve HTTP/1.1 sem problema, e o bloqueio acontece
   antes da camada HTTP.
5. **CORS nao e a causa.** CORS so explica por que o download precisa passar pelo servidor;
   nao tem relacao com o timeout.

### Como remover o workaround, se o Senado corrigir

Rode o teste minimo acima **sem** `--tls-max-v1.2`. Se voltar `status: 200`, tire o host de
`TLS_1_2_ONLY_HOSTS` e rode `npm test -w backend -- src/tests/fetchSourceFile.test.ts`.
Enquanto o teste minimo estourar, o workaround continua necessario. Vale host a host: um
pode ser corrigido antes dos outros.

---

## Referencias

- https://nodejs.org/api/tls.html
- https://nodejs.org/api/https.html
- https://github.com/nodejs/undici/issues/2777
