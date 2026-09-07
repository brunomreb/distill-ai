# Fork Notes

Registo de divergências entre o Stratos Quote Engine e `Distill-AI/distill-ai`.

## Convenções

- `upstream`: `https://github.com/Distill-AI/distill-ai.git`
- branch base: `dev`
- Preferir extensões isoladas a alterações invasivas.
- Cada entrada deve indicar motivo, ficheiros, impacto no merge e testes.

## 2026-09-07 — Fase 0

### Documentação de auditoria

- Motivo: registar o spike e a decisão obrigatória de go/no-go antes de adaptar o produto.
- Ficheiros: `STATE.md`, `FORK-NOTES.md`.
- Impacto no merge: nenhum no runtime; novos ficheiros exclusivos do fork.
- Testes: não aplicável. Evidência executável detalhada em `STATE.md`.

### Configuração local não versionada

- Foi criada uma `.env` ignorada pelo Git apenas para o spike local, com `DEMO_MODE=true`, credenciais locais por defeito e sem chaves de providers.
- Não constitui divergência versionada e não contém segredos reais.

Não foram feitas alterações de produto nessa fase.

## 2026-09-07 — Fase 1: vertical AVAC

### Provider Anthropic e boundary de extração

- Motivo: usar Claude para interpretar texto livre em `ExtractionV1`, mantendo o cálculo fora do LLM, e conservar embeddings OpenAI como dependência independente.
- Ficheiros principais: `.env.example`, `src/config/env.ts`, `src/modules/llm/llm.provider.ts`, `src/modules/llm/tests/llm.provider.spec.ts`, `src/modules/catalog/embeddings-client.service.ts`, `src/modules/extraction/**`.
- Divergência: adapter Anthropic Messages API com JSON Schema em `output_config.format`; fallback OpenAI-compatible preservado; schema/prompt/reconciliação AVAC adicionados ao lado do formato legacy.
- Impacto no merge: moderado e localizado nos adapters/schema. O caminho legacy foi mantido para reduzir conflitos com upstream.
- Testes: contrato dos dois providers, fixture AVAC, schema e reconciliação de factos numéricos.

### Motor determinístico AVAC e dados por organização

- Motivo: suportar pricing por regras editáveis em BD, IVA configurável e isolamento multi-tenant.
- Ficheiros principais: `src/modules/pricing/avac-pricing.engine.ts`, `src/modules/pricing/price.node.ts`, entidades/enums de pricing e quote line items, `src/database/migrations/1782570000000-AddStratosAvacFoundation.ts`, `src/database/migrations/1782580000000-SeedAvacDemo.ts`, `src/modules/organizations/entities/org-branding.entity.ts`.
- Divergência: novos tipos `catalog_unit`, `included_allowance`, `conditional_surcharge`, `fixed_adder`, `labor_hours`, `margin_markup` e `tax`; metadados de vertical/ordenação/chave; `kind` explícito nas linhas; tabela `org_branding`; branch AVAC puro no nó de pricing.
- Fonte de verdade: o branch AVAC carrega `skus`, `pricing_rules` e branding da BD, sempre por `org_id`; não lê preços de config nem do output LLM.
- RLS: `pricing_rules` e `org_branding` ficam protegidas pelo padrão de contexto de organização já usado pelo upstream.
- Impacto no merge: moderado. As migrations e o motor são novos; alterações ao `PriceNode` são uma extensão com fallback integral para o algoritmo upstream.
- Testes: golden AVAC-01 exato, tipos de linha, ausência de desconto LLM, fail-closed sem dados críticos, override de IVA por org e boundary de zero tools nos nós determinísticos.

### Seed e demo reproduzível

- Motivo: permitir demonstração local completa sem chaves nem dados de cliente.
- Ficheiros principais: `src/database/seed/avac_01_demo.json`, `src/common/demo/demo-fixtures.ts`, `Dockerfile.api` e a migration de seed AVAC.
- Divergência: fixture PT-PT com termos de matching, três SKUs Daikin, onze regras e branding da organização fictícia `Clima Atlântico`; fixtures copiadas para a imagem runtime.
- Impacto no merge: baixo. Seed, migration e fixture são aditivos; `Dockerfile.api` recebe apenas um `COPY` adicional.
- Testes: E2E API/worker em Docker e percurso browser completo até ao PDF.

### PDF e branding por organização

- Motivo: produzir o entregável comercial PT-PT com identidade e fiscalidade do cliente, sem valores hardcoded no renderer.
- Ficheiros principais: `src/modules/quotes/services/quote-pdf-renderer.service.ts`, `src/modules/quotes/tools/render-quote-pdf.tool.ts`, `src/modules/quotes/quotes.module.ts`, DTOs/mappers/interfaces de quote.
- Divergência: renderer recebe branding da BD e logo opcional do object store; A4 em PT-PT, cor da organização, NIF, morada, email, telefone, validade, rodapé e IVA configurável.
- Impacto no merge: moderado, concentrado no renderer e wiring do tool. A API pública de quote só foi estendida com `kind`.
- Testes: renderer com branding/IVA e tool de PDF; PDF real validado com `pdfinfo`/`pdftotext`.

### Cliente Stratos e localização do percurso AVAC

- Motivo: transformar o percurso de demonstração no Motor de Orçamentos Stratos, dark-only e PT-PT.
- Ficheiros principais: `client/index.html`, `client/src/index.css`, `client/src/tokens.json`, shell, inbox/formulário manual, processing, review, clarification, quote output e respetivos testes.
- Divergência: identidade visual Stratos dark + teal, Plus Jakarta Sans, moeda `pt-PT`, ações/estados principais localizados e rascunho de email PT-PT. O favicon upstream foi substituído pelo ícone oficial Stratos em `client/public/favicon.png`.
- Origem do asset: `/Users/Bruno/Projects/stratos-content/assets/logos/icon-teal.png`; apenas redimensionado para favicon, sem redesenho.
- Impacto no merge: elevado nas folhas de estilo e componentes visuais, mas sem troca do router, state management ou contratos API do upstream.
- Testes: 43 ficheiros/373 testes client, lint, TypeScript e Vite build.

### Robustez de testes e empacotamento

- Motivo: tornar os resultados independentes de `.env` local e compatíveis com o Node 26 do host.
- Ficheiros principais: `src/test-setup.ts`, `client/src/test-setup.ts`, `Dockerfile.api`.
- Divergência: testes forçam `DEMO_MODE=false` salvo quando um caso o ativa; polyfill de `localStorage` em jsdom; fixture seed incluída na imagem.
- Impacto no merge: baixo, restrito a setup de teste/packaging.
- Validação agregada: API 77 ficheiros/697 testes + 1 `todo`; client 43/373; lint e builds verdes; 23 migrations numa BD vazia; builds Docker e E2E browser verdes.

### Fora do âmbito desta fase

- A Fase 2 (caixilharia) não foi iniciada.
- UI CRUD de catálogo/regras/branding, entrega real por email e onboarding de organizações continuam reservados para a Fase 3.
- Auth de produção e automatização operacional das migrations continuam pendentes antes de usar dados reais.

### Correção pós-demo: registo de orçamentos

- Motivo: a rota `/quotes` herdada do upstream era um placeholder vazio, apesar de existir no menu.
- Ficheiros principais: `src/modules/quotes/quote-list.controller.ts`, `src/modules/quotes/quote.model-action.ts`, `src/modules/quotes/interfaces/quote-summary.interface.ts`, `client/src/api/quotes.ts`, `client/src/pages/Quotes.tsx`.
- Divergência: endpoint `GET /quotes` estritamente filtrado por organização e página PT-PT com pesquisa, métricas, cliente, valor, estado e link para revisão/PDF. O endpoint não expõe o caminho interno do object store e os totais agregados são separados por moeda.
- Impacto no merge: baixo; endpoint e read model são aditivos e substituem apenas o componente placeholder.
- Testes: isolamento/fail-closed do controller, query org-scoped, API client, estados/listagem e proibição de somar moedas distintas. Totais agregados: API 78 ficheiros/701 testes + 1 `todo`; client 44/378.

## 2026-09-07 — Fase 2: vertical caixilharia

### Extração estruturada e reconciliação

- Motivo: interpretar pedidos de janelas/portas sem permitir ao LLM calcular áreas, materiais, preços ou descontos.
- Ficheiros principais: `src/modules/extraction/schemas/extraction-v1.schema.ts`, `src/modules/extraction/tools/extract-request.tool.ts`, `src/modules/extraction/reconcile.ts`, `src/database/seed/caixilharia_01_demo.json`.
- Divergência: ramo `caixilharia` adicionado ao `ExtractionV1`, com `openings[]`, dimensões, abertura, perfil, vidro e opções; o structured output aceita AVAC ou caixilharia e os factos numéricos são reconciliados com o texto de origem.
- Segurança: fixtures verticais só reutilizam dados de cliente corroborados literalmente pelo pedido; a demo não pode carimbar uma identidade pré-gravada num pedido semelhante.
- Impacto no merge: moderado e concentrado no schema/prompt. O ramo AVAC e o formato legacy foram preservados.
- Testes: replay sem provider, ausência de campos de preço/área calculada, reconciliação de dimensões e rejeição de factos não suportados.

### Motor determinístico de caixilharia

- Motivo: calcular cada vão a partir de catálogo e regras editáveis por organização.
- Ficheiros principais: `src/modules/pricing/caixilharia-pricing.engine.ts`, `src/modules/pricing/price.node.ts`, `src/modules/pricing/tests/caixilharia-pricing.engine.spec.ts`.
- Divergência: função pura por vão para área real/faturável, perfil × tipo de abertura, vidro, ferragens, persiana, mosquiteiro, montagem, remoção, transporte, tiers de desconto, markup e IVA.
- Fonte de verdade: todos os preços vêm de `skus`; mínimos, multiplicadores, seletores, descontos, markup e imposto vêm de `pricing_rules`/`org_branding`. Não existe acesso a LLM/tools no motor.
- Fail-closed: dimensões/tipo críticos, regras obrigatórias, SKUs ausentes e moedas misturadas bloqueiam a criação do draft.
- Impacto no merge: baixo; motor novo e dispatch adicional no `PriceNode`, mantendo o algoritmo upstream e AVAC.
- Testes: golden CAIX-01 exato, área mínima 0,5 m²/vão, tiers >15/>30 m², IVA por organização e input crítico em falta.

### Segunda organização e seletor demo multi-tenant

- Motivo: demonstrar os dois verticais isolados desde o primeiro dia, sem ligar autenticação real a dados fictícios.
- Ficheiros principais: migrations `1782590000000-SeedCaixilhariaDemo.ts` e `1782600000000-AddVerticalToOrganizationsAndRequests.ts`, `src/modules/auth/demo-org.ts`, middleware RLS, `src/modules/organizations/**` e read models de pedidos/orçamentos.
- Divergência: organização fictícia `Janelas Madeira Demo`, 10 SKUs, 12 regras e branding próprio; colunas `vertical` em organizações/pedidos; `GET /organizations`; header local `X-Demo-Org-Id` limitado às duas orgs seed quando `AUTH_ENABLED=false`.
- Compatibilidade/rollback: as colunas são aditivas, o pedido aceita `vertical=null` durante ingestão/legacy, e ambas as migrations têm `down`; sem header mantém-se a org AVAC histórica.
- Segurança: o header não aceita UUIDs arbitrários, não é usado quando auth está ativa e os endpoints de pedido/PDF devolvem 404 em acesso cruzado.
- Impacto no merge: moderado no middleware/controllers, aditivo em entidades/API.
- Testes: seleção allowlisted, fallback, listagem de organizações, produção limitada à org autenticada e prova E2E de 404 cross-tenant.
