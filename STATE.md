# Stratos Quote Engine — Estado da Fase 0

Data: 2026-09-07  
Upstream: `Distill-AI/distill-ai`, branch `dev`  
Commit auditado: `2de95a9e1a47ad07d214c8adf0a624e6ed15b0af`  
Fork: `https://github.com/brunomreb/distill-ai`  
Decisão: **GO**

## Resumo executivo

O fork é uma base viável para o Stratos Quote Engine. Instala, compila e executa o fluxo real pedido para o spike: ingestão de texto, extração/classificação por fixtures em `DEMO_MODE`, matching, pricing determinístico, policy, scoring, revisão/aprovação e geração/download de PDF. O smoke E2E oficial terminou com sucesso e produziu um PDF válido de 2328 bytes sem `LLM_API_KEY` nem `EMBEDDINGS_API_KEY`.

A arquitetura é modular e legível. O boundary crítico está implementado de forma útil: `price`, `policy` e `score` recebem serviços determinísticos, não recebem `ToolRegistry`, os nomes são reservados e a suite específica valida que uma execução real por esses três nós não emite `tool.invoked`. A suite API passou integralmente: 75 ficheiros, 690 testes aprovados e 1 `todo`.

Há trabalho significativo, mas localizado, para adaptar o produto aos dois verticais. Não foi encontrada uma razão técnica para abandonar o fork e regressar já ao fallback n8n v2.

## Evidência de execução

| Verificação | Resultado |
|---|---|
| Fork e remotes | `origin` = `brunomreb/distill-ai`; `upstream` = `Distill-AI/distill-ai` |
| `pnpm install --frozen-lockfile` | PASS com Corepack e `pnpm@11.1.1` |
| Build API/worker | PASS |
| Build client | PASS |
| Testes API | PASS — 75 ficheiros; 690 pass; 1 todo |
| Testes client no host | 371 pass; 2 falhas em `App.spec.tsx`, ambas por `localStorage` sob Node 26.3.0; o CI do upstream usa Node 22 |
| Docker build | PASS para API/worker e client, em Apple Silicon/arm64 |
| Postgres/pgvector | saudável; 21 migrações aplicadas |
| Redis | saudável |
| API + worker locais em `DEMO_MODE` | PASS |
| Smoke oficial sem chaves | PASS — ingestão → quote `priced` → aprovação → PDF |
| PDF | PASS — 2328 bytes, cabeçalho `%PDF-` |

Comando equivalente usado no caminho aprovado pelo próprio CI:

```text
DEMO_MODE=true node dist/worker.js
DEMO_MODE=true node dist/main.js
DEMO_MODE=true pnpm smoke:keys-removed
```

## Arranque Docker: achado do spike

`docker compose up -d --build` não é suficiente numa base de dados vazia. API e worker arrancam antes das migrações e a `RecoverySweep` consulta `requests`, provocando reinícios. Depois de `migration:run`, os serviços arrancam e a API fica saudável.

Existe ainda um bug de empacotamento: `Dockerfile.api` copia `dist`, `events.schema.json` e `config`, mas não copia `src/database/seed`. O loader de fixtures resolve esse caminho em runtime. Assim, o mesmo smoke dentro dos contentores falha fechado na extração e termina sem quote; executado localmente, tal como no job `keys-removed-e2e` do CI, passa integralmente. Correção pequena recomendada no início da Fase 1: incluir as fixtures necessárias na imagem ou gerar um artefacto de fixtures dentro de `dist`, e adicionar migração explícita ao runbook/entrypoint.

## Layout real dos módulos

O código contém 24 diretórios de feature em `src/modules`: `analytics`, `auth`, `benchmark`, `catalog`, `clarification`, `classify`, `copilot`, `dlq`, `events`, `extraction`, `health`, `ingestion`, `jobs`, `llm`, `organizations`, `parse`, `pipeline`, `policy`, `pricing`, `quotes`, `redis`, `requests`, `scheduler`, `scoring`, `tools` e `users` (26 contando `organizations` e `users`; `redis` também é módulo de infraestrutura). Existem ainda `common`, `config`, `database`, `queue`, `sse` e `worker` fora desse diretório.

Shape real de runtime:

```text
React/nginx
    -> NestJS API
       -> Postgres 15 + pgvector/pg_trgm
       -> Redis/Bull
          -> worker NestJS
             parse -> extract -> classify -> match -> price -> policy -> score
       -> filesystem object store (attachments e PDFs)
```

O API e o worker são processos separados construídos a partir da mesma imagem. O worker executa o grafo e o API expõe ingestão, revisão, catálogo, clarificação, aprovação/PDF, eventos e analytics. API e worker partilham o volume de object storage no Compose.

## Código real vs `docs/architecture.md`

| Tema | Documento | Código real / drift |
|---|---|---|
| ORM | Exemplos iniciais do blueprint referem uma camada SQL tipada | TypeORM 0.3, entidades e migrations; o próprio documento já mostra sinais de implementação TypeORM |
| Multi-tenancy | O blueprint histórico não o tratava como objetivo V1 completo | `organizations`, `users`, `org_id`, RLS middleware e policies existem; catálogo, requests, quotes, pricing rules e audit events são org-scoped |
| Pricing | Documento descreve pricing determinístico | O pipeline real já carrega `pricing_rules` da BD por org para quantity breaks; coexistem serviços/endpoints legacy que ainda leem JSON de `config/` |
| Tools | Array documental mostra 5 nomes | Runtime regista 7 tools mais um `echo_tool`; inclui `draft_clarification` e `draft_quote_email` |
| Pipeline | Modular monolith + Bull | Confirmado: API produtor, worker consumidor, checkpoints por nó e recovery sweep |
| PDF | `render_quote_pdf` | Real, via PDFKit e object store; o smoke descarregou um PDF válido |
| Email | Draft de follow-up | Só draft/simulação; não existe entrega real do orçamento ao destinatário |
| Auth | Auth + RLS | RLS e guard existem, mas login real devolve 501; produção precisa de IdP/gestão de utilizadores |
| Demo Compose | Stack buildável | Buildável, mas o container não inclui fixtures e o schema não é migrado automaticamente |

## Real, fixture, mock ou incompleto

### Real

- Ingestão manual/form-data e uploads.
- Grafo resumível, Bull/Redis e recovery sweep.
- Audit events persistidos e SSE.
- Extração e classificação por provider OpenAI-compatible fora de demo.
- Catálogo por org com pg_trgm e pgvector.
- Pricing, policy e scoring determinísticos.
- Review/remap, aprovação e PDF persistido.
- Entidades de organizações/utilizadores, middleware RLS e policies de BD.

### Fixture em `DEMO_MODE`

- Respostas do LLM para extração/classificação.
- Matching sem embeddings externos cai para trigram.
- Catálogo e pricing rules da org demo vêm das migrations/seed.

### Mock/simulação ou incompleto

- `auth/login`: 501; gestão real de utilizadores/IdP não implementada.
- Envio de email: handler de simulação e draft, sem provider SMTP/Resend real.
- Copilot é bolt-on e opcional; não é necessário para a demo Stratos.
- Benchmark e parte dos jobs são funcionalidades de referência do starter.
- UI de Settings é essencialmente placeholder; não há CRUD completo de org, branding e regras.
- PDF usa branding fixo do Distill e moeda/defaults do dataset original, não PT-PT/Stratos/org branding.

## Validação das restrições duras

1. **LLM não calcula:** adequado para continuar. `PriceNode`, `PolicyNode` e `ScoreNode` não recebem o registry; `price`, `policy` e `score` são nomes de tool reservados; o teste `deterministic-boundary.spec.ts` percorre a lógica real e confirma zero `tool.invoked`. Não remover nem enfraquecer esta suite.
2. **Editável sem redeploy:** parcialmente pronto. Catálogo e o rule set usado pelo pipeline já estão em tabelas por org; falta UI e falta substituir/retirar do caminho de produto os endpoints legacy baseados em JSON. Branding ainda não está em BD.
3. **PT-PT / IVA:** não implementado. A base usa conteúdo inglês, GBP/NGN e não modela IVA por organização.
4. **Multi-tenant:** base presente desde o início, com `org_id` e RLS. Antes de dados reais é obrigatória auditoria de todas as tabelas dependentes e ativação de auth real.
5. **Perto do upstream:** viável. A arquitetura aceita novos módulos/entidades sem reescrever o pipeline.
6. **Testes exatos de pricing:** infraestrutura Vitest sólida; cada regra Stratos deverá acrescentar golden/unit tests.

## Red flags e mitigação

| Severidade | Red flag | Mitigação proposta |
|---|---|---|
| Alta antes de produção | Auth real não existe; `AUTH_ENABLED=true` não cria um sistema de login operacional | Integrar IdP e testar isolamento cross-org antes de qualquer dado real |
| Alta para o produto | Dois caminhos de regras: BD no pipeline e JSON em endpoints legacy | Tornar BD a única fonte de verdade e remover/ocultar o caminho legacy sem alterar o boundary |
| Média | Fixtures ausentes da imagem Docker | Empacotar fixture artefact e acrescentar smoke contra a imagem |
| Média | Migrations não fazem parte do arranque do Compose | Job/entrypoint de migration com dependência antes de API/worker |
| Média | RLS existe, mas algumas tabelas filhas não têm `org_id` e dependem do parent/service checks | Auditoria RLS por tabela e testes cross-tenant na Fase 1 |
| Média | Pricing atual cobre apenas base price + quantity breaks; schema enum é estreito | Estender tipos e serviço puro para adders/surcharges/IVA, com golden tests |
| Média | PDF e moeda são do produto original | Renderer PT-PT org-scoped com branding aprovado e IVA configurável |
| Baixa | Testes client falham no Node 26 por `localStorage`; upstream fixa CI em Node 22 | Fixar versão local/CI em Node 22 e/ou robustecer setup jsdom |
| Baixa | Instalação dentro da imagem em arm64 tenta fallback nativo de `msgpackr-extract` sem Python, mas continua | Confirmar build limpo em CI amd64 e evitar dependência no addon opcional |

## Decisão

**GO.**

Razões: o caminho crítico foi provado de ponta a ponta; o boundary determinístico está bem desenhado e testado; o catálogo, pricing rules e isolamento por organização já têm fundações reais; os gaps encontrados correspondem ao trabalho esperado nas Fases 1–3 e não exigem reescrever o core.

### Condições para iniciar a Fase 1

1. Preservar os testes e a reserva estrutural de `price`/`policy`/`score`.
2. Corrigir primeiro o packaging das fixtures e tornar o arranque/migração reproduzível.
3. Tratar a BD como fonte de verdade única para regras do pipeline.
4. Manter auth desativada apenas para dados demo; não introduzir dados reais antes de IdP + testes cross-org.
5. Registar cada alteração em `FORK-NOTES.md`.

Fase 1 não foi iniciada neste trabalho.
