---
name: deploy-azure
description: "Guia de deploy na Azure (Container Registry + App Service) e ligacao do auto-deploy (GitHub Actions). Use quando o usuario pedir para deployar, subir para Azure, ou configurar infraestrutura Azure."
---

# Deploy Azure

## 00 — Gate anterior ao deploy

Quando esta skill vier de `10x-inicio-projeto`, exigir a tabela de evidencias do gate local.
Quando for invocada diretamente, produzir essa tabela antes de prosseguir:

| Verificacao | Evidencia minima |
|---|---|
| escopo | plano/checklist concluido e nenhuma pendencia escondida |
| Git | branch correta, worktree limpo e commit reproduzivel |
| segredos | nenhum `.env`, token ou ID live versionado |
| codigo | validador do bootstrap, testes pertinentes, typecheck e lint passando |
| artefato | `npm run build` passando nos dois workspaces |
| produto | smoke do fluxo principal, auth, ownership e erro |
| banco | auditoria `$supabase` concluida pelas fronteiras admin e JWT |
| deploy | Dockerfiles, portas, health, workflow, callback e CORS conferidos |

Qualquer falha bloqueia o deploy. Nao corrigir silenciosamente durante a publicacao: voltar ao
fluxo de implementacao, corrigir, repetir o gate e apresentar nova evidencia.

## Consentimento e variaveis

Com todos os gates aprovados, perguntar se o usuario quer iniciar o deploy. Informar antes:

> Vou ler `backend/.env` e `frontend/.env.local` localmente, validar apenas a presenca das
> variaveis e usa-las nos comandos sem mostrar os valores. Nenhum management token sera enviado
> para a aplicacao. Primeiro mostrarei conta Azure, recursos, regiao, SKUs, custo atual e mutacoes;
> so executarei comandos mutantes da Azure CLI depois de um novo OK.

Depois do primeiro sim:

1. Carregar os envs sem `set -x`, `env`, `printenv`, `cat` ou qualquer output de valores.
2. Validar por nome: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_APP_NAME`.
3. Manter `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` somente no ambiente administrativo;
   nunca envia-los ao App Service.
4. Rodar `az account show` e apresentar assinatura/tenant ativos para confirmacao.
5. Fazer inventario read-only dos nomes pretendidos para distinguir criar de atualizar.
6. Consultar a fonte oficial da Azure para o custo atual dos SKUs considerados.
7. Apresentar tabela final `recurso -> alvo -> criar/atualizar -> SKU -> custo -> impacto`.
8. Perguntar: “Posso executar estas mutacoes pela Azure CLI?”. Aguardar `ok` explicito.

Carregar e validar sem imprimir valores:

```bash
set -a
. backend/.env
. frontend/.env.local
set +a

required_vars=(
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_ANON_KEY
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_APP_NAME
)
missing_vars=()
for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    missing_vars+=("$var_name")
  fi
done
if [ "${#missing_vars[@]}" -gt 0 ]; then
  printf 'Variaveis ausentes: %s\n' "${missing_vars[*]}"
  exit 1
fi
```

Esse preflight pode listar somente nomes ausentes. Nunca imprimir a lista completa do ambiente.

Nenhum `az group create`, `az acr create`, `az appservice`, `az webapp`, build remoto ou alteracao
de app settings pode ocorrer antes do segundo OK.

Perguntar o **slug do projeto** caso nao esteja claro pelo contexto (ex.: `10xmkt`, `minhaloja`).
Derivar os nomes dos recursos e apresentar a tabela antes de qualquer comando mutante.

> Esta skill cobre o **setup inicial da infra** (passos 01–10) **e a ligacao do auto-deploy** via GitHub Actions (passo 11). O `.github/workflows/deploy.yml` vem com placeholders `seu-...` e **aborta no preflight** ate ser configurado — o passo 11 é o que preenche o `env:` do workflow + os secrets. **Avise o usuario disso**: sem preencher, o push na `main` falha de proposito.

## Regra de nomes

O slug **nao pode ter tracos** no Container Registry. Se o usuario passar `minha-loja`, normalize para `minhaloja` apenas no CR.

| Recurso | Nome |
|---|---|
| Resource Group | `resource-{slug}` |
| Container Registry | `cr{slug}` (sem tracos) |
| App Service Plan | `app-plan-{slug}` |
| Backend App | `web-backend-{slug}` |
| Frontend App | `web-frontend-{slug}` |

Apresente sempre a tabela preenchida com os nomes reais antes de comecar.

---

## 01 — Azure CLI

```bash
# Instalar (Windows)
winget install Microsoft.AzureCLI

# Verificar
az --version

# Login
az login --use-device-code
```

> Apos instalar, feche e reabra o terminal antes de continuar.

---

## 02 — Resource Group

```bash
az group create --name resource-{slug} --location "Brazil South"
```

Verificar registro do provider:
```bash
az provider show --namespace Microsoft.ContainerRegistry --query "registrationState"
# Esperado: "Registered"
```

---

## 03 — Container Registry

Antes de criar, pergunte ao usuario qual SKU do Container Registry ele quer:

| SKU | Storage | Uso indicado |
|---|---|---|
| `Basic` | 10 GiB | Dev, projetos pequenos |
| `Standard` | 100 GiB | Producao na maioria dos casos |
| `Premium` | 500 GiB | Geo-replicacao, private endpoints |

Consultar e apresentar o preco oficial atual antes da escolha; nao reutilizar estimativa antiga.

```bash
# Criar (substitua {sku} pelo escolhido: Basic, Standard ou Premium)
az acr create \
  --resource-group resource-{slug} \
  --name cr{slug} \
  --sku {sku} \
  --admin-enabled true

# Build e push — Backend (roda na nuvem, sem Docker local)
az acr build \
  --registry cr{slug} \
  --image {slug}-backend:latest \
  --file backend/Dockerfile \
  .

# Build e push — Frontend (NEXT_PUBLIC_* embutidas no build)
az acr build \
  --registry cr{slug} \
  --image {slug}-frontend:latest \
  --file frontend/Dockerfile \
  --build-arg "NEXT_PUBLIC_API_URL=https://web-backend-{slug}.azurewebsites.net" \
  --build-arg "NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  .
```

Registrar provider Microsoft.Web:
```bash
az provider register --namespace Microsoft.Web
az provider show --namespace Microsoft.Web --query "registrationState"
# Esperado: "Registered"
```

---

## 04 — App Service Plan

Antes de criar, pergunte ao usuario qual SKU ele quer:

| SKU | Perfil | Limitacoes |
|---|---|---|
| `F1` | teste | Cota limitada, sem recursos essenciais de producao |
| `B1` | producao pequena | Dedicated, custom domain e SSL |
| `B2` | producao media | Mais CPU e memoria que B1 |
| `S1` | producao escalavel | Auto-scale e staging slots |

Consultar e apresentar o preco oficial atual da regiao escolhida antes da confirmacao.

```bash
# Substitua {sku} pelo escolhido: F1, B1, B2, S1...
az appservice plan create \
  --name app-plan-{slug} \
  --resource-group resource-{slug} \
  --is-linux \
  --sku {sku}
```

---

## 05 — App Service Backend

```bash
az webapp create \
  --resource-group resource-{slug} \
  --plan app-plan-{slug} \
  --name web-backend-{slug} \
  --deployment-container-image-name cr{slug}.azurecr.io/{slug}-backend:latest
```

---

## 06 — App Service Frontend

```bash
az webapp create \
  --resource-group resource-{slug} \
  --plan app-plan-{slug} \
  --name web-frontend-{slug} \
  --deployment-container-image-name cr{slug}.azurecr.io/{slug}-frontend:latest
```

---

## 07 — Configurar porta (obrigatorio no Azure)

```bash
# Backend (porta 8000)
az webapp config appsettings set \
  --name web-backend-{slug} \
  --resource-group resource-{slug} \
  --settings WEBSITES_PORT=8000 \
  --output none

# Frontend (porta 8080)
az webapp config appsettings set \
  --name web-frontend-{slug} \
  --resource-group resource-{slug} \
  --settings WEBSITES_PORT=8080 \
  --output none
```

---

## 08 — Variaveis de Ambiente — Backend

```bash
az webapp config appsettings set \
  --name web-backend-{slug} \
  --resource-group resource-{slug} \
  --settings \
    PORT=8000 \
    NODE_ENV=production \
    SUPABASE_URL="$SUPABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --output none
```

---

## 09 — Variaveis de Ambiente — Frontend

> As `NEXT_PUBLIC_*` ja foram embutidas no build (passo 03). As abaixo sao extras se necessario.

```bash
az webapp config appsettings set \
  --name web-frontend-{slug} \
  --resource-group resource-{slug} \
  --settings \
    NEXT_PUBLIC_API_URL=https://web-backend-{slug}.azurewebsites.net \
    NEXT_PUBLIC_APP_NAME="$NEXT_PUBLIC_APP_NAME" \
    NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --output none
```

---

## 10 — Verificar Deploy

```bash
curl https://web-backend-{slug}.azurewebsites.net/health
```

- **Frontend:** `https://web-frontend-{slug}.azurewebsites.net`
- **Backend:** `https://web-backend-{slug}.azurewebsites.net/health`

---

## 11 — CI/CD: auto-deploy no push (GitHub Actions)

A infra ja existe; agora ligue o **auto-deploy** (push na `main` → deploy). Edite o bloco `env:` de `.github/workflows/deploy.yml` com os nomes derivados do `{slug}`:

| `env:` do workflow | Valor |
|---|---|
| `APP_NAME` | nome exibido do produto |
| `ACR_NAME` | `cr{slug}` |
| `RESOURCE_GROUP` | `resource-{slug}` |
| `BACKEND_APP` | `web-backend-{slug}` |
| `FRONTEND_APP` | `web-frontend-{slug}` |
| `BACKEND_IMAGE` | `{slug}-backend` |
| `FRONTEND_IMAGE` | `{slug}-frontend` |
| `BACKEND_PUBLIC_URL` | `https://web-backend-{slug}.azurewebsites.net` |

Configure os **Secrets** do repo (Settings → Secrets and variables → Actions):
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — do service principal (OIDC)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — baked no build do front

> **Enquanto o `env:` tiver `seu-...`, o workflow aborta no preflight** com erro — por isso é importante passar por aqui. Depois de preenchido, todo push na `main` deploya sozinho (e da pra disparar manual via "Run workflow").

Service principal pro OIDC (se ainda nao existe):
```bash
az ad sp create-for-rbac --name "sp-{slug}-deploy" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/resource-{slug}
```
