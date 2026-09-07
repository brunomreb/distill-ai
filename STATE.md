# Stratos Quote Engine — Estado

Data: 2026-09-07

Upstream: `Distill-AI/distill-ai`, branch `dev`

Base auditada: `2de95a9e1a47ad07d214c8adf0a624e6ed15b0af`

Fork: `https://github.com/brunomreb/distill-ai`

Fase atual concluída: **Fase 1 — AVAC demo-ready**

Próxima fase: **Fase 2 — não iniciada**

## Estado executivo

A Fase 1 está concluída localmente. É possível colar um pedido AVAC em texto livre na UI, processá-lo, rever os dados extraídos, gerar o orçamento por um motor determinístico, aprová-lo e descarregar um PDF A4 com branding e IVA da organização.

O cenário golden gera exatamente oito linhas e o total de **8 315,27 €**. O percurso real foi executado no browser contra a stack Docker, não apenas por testes unitários.

Artefactos da demo:

- UI final: [`docs/demo/phase-1-avac.png`](docs/demo/phase-1-avac.png)
- Registo navegável: [`docs/demo/phase-1-quotes-register.png`](docs/demo/phase-1-quotes-register.png)
- PDF efetivamente descarregado pela UI: [`docs/demo/phase-1-avac.pdf`](docs/demo/phase-1-avac.pdf)
- Aplicação local, enquanto a stack estiver ativa: `http://localhost:8080`
- Pedido de evidência: `c94598e2-9c2f-4b64-8e50-f8ae4e66e40e`

## Checklist da Fase 1

- [x] Provider LLM adaptado para Anthropic Messages API, modelo por defeito `claude-sonnet-5` e structured output JSON Schema.
- [x] Embeddings desacoplados do provider de interpretação; OpenAI `text-embedding-3-small` por defeito.
- [x] `ExtractionV1` AVAC implementado com os campos da secção 6 e validação Zod estrita.
- [x] Prompt proíbe o LLM de calcular ou inventar preços, descontos, impostos, margens, áreas ou quantidades implícitas.
- [x] Factos numéricos AVAC reconciliados com o texto de origem; ausência de dados críticos falha fechada.
- [x] `pricing_rules` estendida com `vertical`, `rule_key`, `sort_order` e tipos de regra AVAC.
- [x] `org_branding` criada com RLS por `org_id`, IVA, validade, cor, logo e dados fiscais/contactos.
- [x] Motor AVAC puro carrega catálogo, regras e branding da BD da organização.
- [x] Seed AVAC com três SKUs Daikin, onze regras e branding da org demo `Clima Atlântico`.
- [x] Formulário manual existente adaptado/localizado para colar o pedido na UI.
- [x] Revisão humana e ecrã de orçamento principal em PT-PT.
- [x] Registo navegável de orçamentos com cliente, valor, estado e acesso ao PDF.
- [x] PDF A4 PT-PT com branding por organização e IVA configurável.
- [x] Golden test exato e testes fail-closed.
- [x] Fixtures incluídas na imagem Docker, corrigindo o achado de packaging da Fase 0.

## Golden test AVAC-01

Entrada coberta por fixture/teste: casa em Câmara de Lobos, sala de 35 m², dois quartos de 14 m², preferência Daikin, 6 m de tubagem e condensadora a 6 m das unidades interiores.

| Linha | Tipo | Valor exato |
|---|---|---:|
| Daikin Perfera FTXM35 × 1 | equipment | 1 100,00 € |
| Daikin Perfera FTXM25 × 2 | equipment | 1 800,00 € |
| Daikin Multi+ exterior × 1 | equipment | 1 800,00 € |
| Tubagem adicional: 3 m × 14,50 € | material | 43,50 € |
| Distância adicional à condensadora: 1 m × 18,00 € | material | 18,00 € |
| Instalação: 12 h × 30,00 € | labor | 360,00 € |
| Margem comercial: 32% | margin | 1 638,88 € |
| IVA: 23% | tax | 1 554,89 € |
| **Subtotal sem IVA** |  | **6 760,38 €** |
| **Total** |  | **8 315,27 €** |

Também está provado que trocar apenas a regra de IVA da organização de 23% para 6%, sem alterar código, muda o total exato para **7 166,00 €**.

## Restrições duras

| Restrição | Estado e evidência |
|---|---|
| LLM interpreta; nunca calcula | Mantida. `price`, `policy` e `score` continuam isolados de tools/LLM; a suite do boundary confirma zero `tool.invoked`. O novo motor `priceAvacQuote` é uma função pura sem dependência de LLM ou registry. |
| Preços/regras/branding sem redeploy | Catálogo, regras e branding são linhas da BD por org. Os valores do motor e PDF vêm dessas linhas. A UI CRUD pertence explicitamente à Fase 3. |
| PT-PT e IVA configurável | Percurso principal e PDF localizados. IVA por defeito 23%, lido da organização e coberto por teste de override a 6%. |
| Multi-tenant desde o início | Catálogo, regras, branding, pedido e orçamento são org-scoped. As novas tabelas têm RLS por `org_id`. |
| Fork próximo do upstream | O pipeline existente foi estendido; o ramo legacy continua intacto para pedidos não AVAC. Todas as divergências estão em `FORK-NOTES.md`. |
| Teste por lógica de pricing | Golden test de oito linhas, total exato, missing critical input e IVA por organização. |

## Arquitetura implementada na Fase 1

```text
Texto livre
  -> Claude/fixture: interpretação estruturada ExtractionV1 AVAC
  -> reconciliação dos factos com a origem
  -> catálogo + pricing_rules + org_branding filtrados por org_id
  -> priceAvacQuote (função pura e determinística)
  -> revisão humana
  -> aprovação
  -> PDF A4 PT-PT no object store
```

O adapter Anthropic envia o JSON Schema no `output_config.format` da Messages API. Em `DEMO_MODE`, a extração usa uma fixture determinística; isto permite demonstrar o produto sem chaves e sem transformar o LLM num calculador.

## Evidência de validação

| Verificação | Resultado |
|---|---|
| Testes API/worker | PASS — 78 ficheiros; 701 testes; 1 `todo` |
| Testes client | PASS — 44 ficheiros; 378 testes |
| Lint API | PASS |
| Lint client | PASS |
| Build API/worker | PASS |
| Build client | PASS |
| Docker build API/client | PASS |
| Migrações numa BD vazia | PASS — 23 migrações aplicadas |
| Health API, PostgreSQL e Redis | PASS |
| E2E API/worker em Docker | PASS — ingestão, extração, pricing, aprovação e PDF |
| E2E no browser | PASS — colar pedido, processar, rever, gerar, aprovar e descarregar PDF |
| PDF | PASS — A4, 1 página, 2 836 bytes, oito linhas e total golden |

## Limites conscientes desta fase

- O adapter Claude e o payload de structured output estão cobertos por testes de contrato com respostas simuladas; a demo E2E usa `DEMO_MODE` porque não foi fornecida uma chave Anthropic real.
- O envio externo de email pertence à Fase 3 segundo o brief. Nesta fase existe o rascunho PT-PT e o PDF descarregável, mas não é efetuado envio real.
- A edição por UI de catálogo, regras e branding pertence à Fase 3. Nesta fase os três já são editáveis diretamente em BD, sem alteração de código ou redeploy.
- Auth real continua pendente do trabalho de produção. `DEMO_MODE` e auth desligada só são aceitáveis para dados de demonstração.
- As áreas auxiliares herdadas do upstream ainda podem conter linguagem/conceitos do produto original; o percurso da demo AVAC foi convertido para Stratos/PT-PT.

## Decisão da Fase 0 — histórico

**GO**, entregue no commit `6d2cabf`.

O spike provou instalação, builds, 690 testes API, 371 testes client, Docker, pipeline completo em `DEMO_MODE` e PDF. Identificou quatro lacunas principais: fixtures ausentes da imagem, migração necessária antes do primeiro arranque, branding/IVA não modelados e UI/auth/envio incompletos. A Fase 1 corrigiu o packaging das fixtures e implementou o slice AVAC, regras em BD, branding e IVA; migração operacional, auth de produção, UI admin e entrega de email continuam nas fases previstas.

## Gate seguinte

**A Fase 2 (caixilharia) não foi iniciada.** Este ficheiro e o relatório de fim de Fase 1 são o ponto de controlo antes de qualquer novo vertical.
