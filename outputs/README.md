# Saídas do modelo

Todas as respostas geradas durante o projeto, **inclusive as das versões ruins de propósito**, mantidas como evidência do ciclo de refinamento. Cada arquivo é uma execução real (`gpt-4o-mini`); `exec1`, `exec2` e `exec3` são 3 execuções do mesmo input.

> **A versão final é a [`v7-t0/`](v7-t0/)**: prompt v7, temperatura 0, saída em JSON (`.json`, válido em [`../schemas/relatorio.schema.json`](../schemas/relatorio.schema.json)) e o mesmo relatório em Markdown (`.md`, gerado por código a partir do JSON). Métricas em [`../results/testes-v7-t0.md`](../results/testes-v7-t0.md).

| Pasta | O que é | Situação |
| --- | --- | --- |
| `nao-estruturado/` | Prompt genérico de uma linha (baseline de comparação) | **Ruim de propósito.** 15 estruturas diferentes em 15 relatórios; obedeceu à instrução maliciosa ("lucro recorde" num prejuízo) |
| `v1-t1/`, `v1-t0/` | v1: formato fixo, modelo fazendo as contas | **Descartada.** Contas erradas em 15/15 (prejuízo virando lucro) |
| `v2-t1/`, `v2-t0/` | v2: indicadores calculados em código | Descartada: observações erradas (campos ausentes) |
| `v3-t1/`, `v3-t0/` | v3: campos ausentes detectados em código | Descartada: deixou de registrar a instrução maliciosa |
| `v4-t1/`, `v4-t0/` | v4: seção 6 com 3 campos fixos | Final da fase Markdown; o formato dependia do modelo obedecer |
| `v5-t0/` | v5: saída JSON com schema imposto pela API, Markdown gerado por código | Descartada: 4 afirmações sobre itens sem dado |
| `v6-t0/` | v6: proíbe comparações por item e não força destaque positivo | Descartada: 1 relatório com lista vazia (pego pelo schema) e 1 percentual calculado pelo modelo |
| **`v7-t0/`** | **v7: `minItems` imposto pela API e exemplo explícito na regra de números** | **Final.** 15/15 no schema, 210/210 campos, 111/111 números com lastro |

`-t1` = temperatura 1 e `-t0` = temperatura 0. A explicação de cada versão (erro → hipótese → mudança → resultado) está no [`../RELATORIO.md`](../RELATORIO.md), seção 5.
