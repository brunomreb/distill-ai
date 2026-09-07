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

Não foram feitas alterações de produto nem iniciada a Fase 1.
