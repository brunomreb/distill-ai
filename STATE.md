# Stratos Quote Engine — Estado

Data: 2026-09-08

Upstream: `Distill-AI/distill-ai`, branch `dev`

Base auditada: `2de95a9e1a47ad07d214c8adf0a624e6ed15b0af`

Fork: `https://github.com/brunomreb/distill-ai`

Fase atual concluída: **Fase 3 — camada “editar sem código”**

Próxima fase: **Fase 4 — deploy piloto**

## Estado executivo

Os dois verticais pedidos estão funcionais no mesmo fork. A organização selecionada determina o vertical, catálogo, regras, branding, IVA, pedidos e orçamentos. Em ambos os casos o percurso é texto livre → extração estruturada → cálculo determinístico → revisão humana → aprovação → PDF PT-PT → envio explícito por email.

A Fase 3 torna a operação diária editável na aplicação: produtos, preços, regras determinísticas, IVA e branding já não exigem código nem redeploy. A importação CSV/XLSX faz upsert por organização e agenda a regeneração dos embeddings num worker durável depois do commit. Uma varredura repetível recupera imports que tenham sido interrompidos antes do enqueue; o worker aplica RLS por organização, bloqueio atómico por SKU e deduplicação Bull. O onboarding local cria organizações demo persistentes. O logótipo é carregado para o object store privado, servido à UI por endpoint autenticado e utilizado pelo renderer do PDF.

O golden AVAC mantém o total exato de **8 315,27 €**. O novo golden de caixilharia gera 13 linhas e o total exato de **5 669,25 €**. O fluxo de caixilharia foi executado na stack Docker real, incluindo aprovação, PDF e prova de isolamento cross-tenant.

Artefactos e acesso:

- Aplicação local, enquanto a stack estiver ativa: `http://localhost:8080`
- Registo de orçamentos: `http://localhost:8080/quotes`
- Administração de catálogo, regras e branding: `http://localhost:8080/catalog`
- Onboarding local: `http://localhost:8080/settings`
- Exemplo CSV: `docs/demo/phase-3-catalog-sample.csv`
- Pedido caixilharia de evidência: `26127d9c-d077-4165-bc8e-bd5464456920`
- Pedido AVAC de evidência: `c94598e2-9c2f-4b64-8e50-f8ae4e66e40e`
- Registo visível: `docs/demo/phase-2-quotes-register.png`
- Orçamento caixilharia: `docs/demo/phase-2-caixilharia.png`
- PDF caixilharia: `docs/demo/phase-2-caixilharia.pdf`

## Checklist da Fase 3

- [x] CRUD de catálogo por organização, com preços em minor units, normalização e desativação sem apagar histórico.
- [x] CRUD de regras AVAC/caixilharia com validação Zod do formato consumido pelos motores determinísticos.
- [x] Branding e IVA editáveis por organização; upload PNG/JPEG até 2 MB para o object store.
- [x] Importação CSV/Excel com cabeçalhos PT/EN, conversão decimal exata, erros por linha e upsert org-scoped.
- [x] Imports concorrentes da mesma organização serializados por advisory lock; organizações diferentes continuam paralelas.
- [x] Re-embedding agendado numa fila Bull apenas depois do commit da transação RLS.
- [x] Recuperação repetível de embeddings `pending`, com contexto RLS, bloqueio atómico e um job vivo por SKU.
- [x] Envio explícito de PDF por Resend; em demo é simulado e nunca contacta destinatários reais.
- [x] Idempotency key estável por orçamento e bloqueio de retry automático fora da janela segura do provider.
- [x] Retry de quote já enviada também reconcilia o estado do pedido sem voltar a contactar o provider.
- [x] Onboarding local persistente e seleção dinâmica de organizações demo sem alterar código.
- [x] Novos CRUDs usam o `EntityManager` do pedido, onde `app.org_id` foi definido pelo middleware RLS.
- [x] UI de administração e onboarding construída pelo Claude Code, revista e integrada pelo Codex.
- [x] Registo `/quotes` e detalhe navegável mostram linhas, quantidades, preços, subtotal, desconto e total.

## Checklist da Fase 2

- [x] `ExtractionV1` estendido com `openings[]`, dimensões, quantidade, tipo de abertura, perfil, vidro e opções.
- [x] Prompt e schema impedem preços, áreas calculadas, descontos, margens e quantidades implícitas vindos do LLM.
- [x] Dimensões, quantidade, piso e distância reconciliados com o texto original.
- [x] Motor puro de caixilharia calcula cada vão a partir de catálogo e regras da BD.
- [x] Área mínima faturável, perfil × abertura, vidro, ferragens, persiana, mosquiteiro, montagem, remoção, deslocação, desconto por área, margem e IVA suportados.
- [x] Vãos fixos não recebem ferragens.
- [x] Missing dimensions/rules/SKUs e moedas mistas falham fechado.
- [x] Organização demo `Janelas Madeira Demo` com 10 SKUs, 12 regras, branding e IVA 23%.
- [x] `vertical` persistido em organizações/pedidos e exposto nos read models.
- [x] Seletor de organização demo e badges de vertical no client.
- [x] Pedidos, catálogo, orçamentos e analytics continuam filtrados por organização.
- [x] Header demo limitado às duas organizações seed e ignorado com autenticação ativa.
- [x] Mesmo fluxo de revisão, aprovação, PDF e registo navegável usado por AVAC e caixilharia.
- [x] Golden test CAIX-01 exato e teste E2E real.

## Golden test CAIX-01

Entrada: duas janelas PVC oscilo-batentes de 1 200 × 1 400 mm com vidro duplo low-e, persiana e mosquiteiro; uma porta de correr em alumínio de 1 800 × 2 100 mm; remoção da caixilharia existente; montagem e 15 km de deslocação.

| Linha                           |    Valor exato |
| ------------------------------- | -------------: |
| J1 — perfil PVC × abertura      |       714,84 € |
| J1 — vidro duplo low-e          |       319,20 € |
| J1 — ferragens oscilo-batentes  |       170,00 € |
| J1 — persiana                   |       369,60 € |
| J1 — mosquiteiro                |       150,00 € |
| P1 — perfil alumínio × abertura |     1 081,08 € |
| P1 — vidro duplo low-e          |       359,10 € |
| P1 — ferragens de correr        |       120,00 € |
| Montagem de 3 vãos              |       270,00 € |
| Remoção de 3 vãos               |       120,00 € |
| Deslocação de 15 km             |        13,50 € |
| Margem comercial                |       921,83 € |
| IVA 23%                         |     1 060,10 € |
| **Subtotal sem IVA**            | **4 609,15 €** |
| **Total**                       | **5 669,25 €** |

O motor também cobre a área mínima de 0,5 m² por vão, descontos de 4% acima de 15 m² e 7% acima de 30 m², e override do IVA por organização.

## Restrições duras

| Restrição                           | Estado e evidência                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM interpreta; nunca calcula       | Mantida nos dois verticais. `price`, `policy` e `score` não invocam LLM/tools. `priceAvacQuote` e `priceCaixilhariaQuote` são funções puras; o CI testa o boundary. |
| Preços/regras/branding sem redeploy | Catálogo, regras, IVA e branding são dados da BD por organização e têm CRUD/import/upload na UI. Nenhum preço do vertical está no prompt ou no output do LLM.       |
| PT-PT e IVA configurável            | Percursos principais e PDFs estão localizados. O IVA vem de `org_branding.iva_rate`, 23% nos seeds e coberto por override.                                          |
| Multi-tenant desde o início         | Organização, vertical, SKUs, regras, branding, pedidos, quotes e PDFs são org-scoped. Acesso cross-org devolve 404.                                                 |
| Fork próximo do upstream            | Foram adicionados schemas, motores, migrations e read models isolados; o caminho legacy continua disponível. Divergências registadas em `FORK-NOTES.md`.            |
| Teste por lógica de pricing         | Existem goldens exatos AVAC e caixilharia, testes de limites, IVA, dados críticos, moedas e ausência de LLM no pricing.                                             |

## Arquitetura implementada

```text
Organização selecionada (AVAC ou caixilharia)
  -> texto livre
  -> Claude/fixture: interpretação estruturada ExtractionV1
  -> reconciliação de factos numéricos com a origem
  -> catálogo + pricing_rules + org_branding por org_id
  -> motor puro do vertical
  -> revisão humana
  -> aprovação
  -> PDF A4 PT-PT no object store
```

Em `DEMO_MODE`, fixtures determinísticas substituem apenas a chamada ao provider. O pricing usa exatamente o mesmo código e os mesmos dados de BD usados fora da demo.

## Evidência de validação

| Verificação                 | Resultado                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Testes API/worker           | PASS — 89 ficheiros; 765 testes; 1 `todo`                                                               |
| Testes client               | PASS — 61 ficheiros; 525 testes                                                                         |
| Lint API e build API/worker | PASS                                                                                                    |
| Lint e build client         | PASS                                                                                                    |
| Migração Fase 3             | PASS — rollback/reaplicação em PostgreSQL real; dados das organizações preservados                      |
| Seed caixilharia            | PASS — 10 SKUs, 12 regras, branding e IVA 0,23                                                          |
| E2E API/worker em Docker    | PASS — ingestão, extração, pricing, aprovação e PDF                                                     |
| Isolamento multi-tenant     | PASS — pedido caixilharia consultado como AVAC devolve 404                                              |
| E2E no browser              | PASS — registo com 5 orçamentos, detalhe com linhas/totais navegável, APIs 200 e zero erros de consola  |
| CRUD admin real             | PASS — criar/editar/desativar produto e criar/desativar regra pela API Docker                           |
| Import/worker real          | PASS — CSV PT, `149,90 € → 14 990`, estado `pending → unavailable` em demo via worker pós-commit        |
| Branding real               | PASS — upload PNG de 9 117 bytes e leitura autenticada byte-a-byte idêntica; `logo_url` manual = 400    |
| Proxy client                | PASS — organizações/orçamentos = 200 via `:8080` após recriar serviços; DNS Docker resolvido em runtime |
| PDF caixilharia             | PASS — A4, 2 páginas, 3 893 bytes, branding `Janelas Madeira`, 13 linhas e total golden                 |

## Limites conscientes desta fase

- A demo usa fixtures porque não foi fornecida uma chave Anthropic real; o adapter Claude e o structured output são cobertos por testes de contrato.
- O seletor por header é exclusivamente local/demo e só funciona com autenticação desligada. Dados reais exigem `AUTH_ENABLED=true` e um identity provider.
- O envio Resend real não foi disparado por falta de uma chave/destinatário de teste; o contrato HTTP, attachment, segredo, idempotência e modo demo estão cobertos por testes.
- O onboarding com autenticação real fica fechado até existir um papel de administrador de plataforma; um admin de tenant não pode criar outra organização.
- Uma tentativa de email com estado incerto há 23 horas ou mais exige reconciliação manual, evitando duplicados fora da garantia de idempotência do provider.
- O PDF de caixilharia ocupa duas páginas com o conjunto golden de 13 linhas; paginação e conteúdo estão corretos, mas a composição visual pode ser refinada com templates adicionais na Fase 4.
- Áreas auxiliares herdadas do upstream ainda serão progressivamente localizadas; o percurso comercial dos dois verticais está em PT-PT.

## Histórico das fases

### Fase 3 — editar sem código

Concluída no branch `dev`. O Claude Code entregou o front-end em quatro commits isolados (`bb7f281`, `e9020cd`, `3c9c076`, `4a5ac5e`); o Codex implementou o back-end, reviu os contratos, corrigiu a integração e executou a validação agregada. Catálogo, regras, branding, IVA, onboarding, importação e envio passaram a ser operações da aplicação.

### Fase 1 — AVAC

Concluída no commit `b6c8c47`. O golden AVAC produz oito linhas, subtotal **6 760,38 €**, IVA **1 554,89 €** e total **8 315,27 €**. Alterar apenas o IVA da organização para 6% muda o total para **7 166,00 €**, sem código ou redeploy.

Artefactos:

- `docs/demo/phase-1-avac.png`
- `docs/demo/phase-1-quotes-register.png`
- `docs/demo/phase-1-avac.pdf`

### Fase 0 — spike

**GO**, entregue no commit `6d2cabf`. O spike provou instalação, builds, Docker, pipeline completo em `DEMO_MODE` e PDF; o fork foi considerado uma base viável.

## Gate seguinte

**Fase 3 concluída.** A Fase 4 só deve começar com destino de deploy, domínio, identity provider e credenciais de infraestrutura/provider definidos.
