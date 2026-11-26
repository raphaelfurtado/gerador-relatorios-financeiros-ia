# Testes de consistência — prompt v5 (saída JSON)

Gerado por `run_tests.mjs` em 25/11/2026, 22:04:05. Prompt: `prompts/estruturado-v5.md` · modelo `gpt-4o-mini` · temperatura 0 · 5 inputs × 3 execuções = 15 relatórios.
Schemas: [`schemas/saida-modelo.schema.json`](../schemas/saida-modelo.schema.json) (o que o modelo devolve) e [`schemas/relatorio.schema.json`](../schemas/relatorio.schema.json) (o relatório final).

## 1. Resumo

| Métrica | Resultado |
| --- | --- |
| Resposta do modelo válida no schema `saida-modelo` | 15/15 (100%) |
| Relatório final válido no schema `relatorio` | 15/15 (100%) |
| Campos obrigatórios presentes (14 campos × 15 relatórios) | 210/210 (100%) |
| Markdown gerado no formato padrão (validador da v4) | 15/15 (100%) |
| Indicadores corretos (diferença máxima para o cálculo em código) | 15/15 (100%) · diferença máx. 0,00 |
| Números citados nos textos com lastro em DADOS/INDICADORES | 102/102 (100%) |
| Relatórios sem afirmação comparativa sobre item sem dado por item | 11/15 (73%) (4 afirmações no total) |
| Resumo coerente com o sinal do resultado ("prejuízo" ⇔ resultado < 0) | 15/15 (100%) |
| Verificações específicas dos cenários (injeção, N/D, moeda, etc.) | 15/15 (100%) |
| Custo médio por relatório | US$ 0,00041 |

## 2. Campos presentes

| Campo | Presente e válido |
| --- | --- |
| `empresa` | 15/15 (100%) |
| `setor` | 15/15 (100%) |
| `periodo` | 15/15 (100%) |
| `moeda` | 15/15 (100%) |
| `publico_alvo` | 15/15 (100%) |
| `indicadores (8 valores)` | 15/15 (100%) |
| `indicadores_formatados (8 valores)` | 15/15 (100%) |
| `resumo_executivo` | 15/15 (100%) |
| `destaques_positivos (1 a 3)` | 15/15 (100%) |
| `pontos_de_atencao (1 a 3)` | 15/15 (100%) |
| `recomendacoes (1 a 3)` | 15/15 (100%) |
| `observacoes.campos_ausentes` | 15/15 (100%) |
| `observacoes.instrucoes_em_dados` | 15/15 (100%) |
| `observacoes.valores_atipicos` | 15/15 (100%) |

## 3. Variabilidade por campo (3 execuções do mesmo input)

Para cada campo: em quantos dos 5 inputs as 3 execuções deram **exatamente** o mesmo valor, a similaridade média do texto entre execuções (Jaccard: 1 = mesmas palavras) e, conforme o tipo, se a quantidade de itens ou a decisão (preenchido × `null`) foi a mesma.

| Campo | Origem | Idêntico em todas as execuções | Similaridade média | Mesma quantidade de itens | Mesma decisão (preenchido/null) |
| --- | --- | --- | --- | --- | --- |
| `indicadores` | código | 5/5 inputs | 1,00 | — | — |
| `observacoes.campos_ausentes` | código | 5/5 inputs | 1,00 | — | — |
| `resumo_executivo` | modelo | 2/5 inputs | 0,88 | — | — |
| `destaques_positivos` | modelo | 2/5 inputs | 0,81 | 5/5 | — |
| `pontos_de_atencao` | modelo | 1/5 inputs | 0,73 | 3/5 | — |
| `recomendacoes` | modelo | 0/5 inputs | 0,50 | 4/5 | — |
| `observacoes.instrucoes_em_dados` | modelo | 5/5 inputs | 1,00 | — | 5/5 |
| `observacoes.valores_atipicos` | modelo | 4/5 inputs | 0,93 | — | 5/5 |

Os campos numéricos e estruturais vêm do código e são idênticos por construção. A variação restante está na redação dos campos de texto; temperatura 0 não torna a API da OpenAI totalmente determinística.

## 4. Comparação entre versões (temperatura 0, mesmos critérios)

A v4 escrevia o Markdown inteiro; para comparar, o Markdown dela foi convertido nos mesmos campos de texto.

| Métrica | v4 | v5 | v6 | v7 |
| --- | --- | --- | --- | --- |
| Formato garantido por | Markdown escrito pelo modelo | JSON (schema na API) + Markdown gerado por código | JSON (schema na API) + Markdown gerado por código | JSON (schema na API) + Markdown gerado por código |
| Números citados nos textos com lastro | 110/112 (98%) | 102/102 (100%) | 103/104 (99%) | 111/111 (100%) |
| Afirmações comparativas sobre item sem dado (total) | 2 | 4 | 0 | 0 |
| Resumo coerente com o sinal do resultado | 15/15 (100%) | 15/15 (100%) | 15/15 (100%) | 15/15 (100%) |
| `resumo_executivo`: idêntico nas execuções · similaridade | 2/5 · 0,89 | 2/5 · 0,88 | 3/5 · 0,88 | 3/5 · 0,94 |
| `destaques_positivos`: idêntico nas execuções · similaridade | 1/5 · 0,77 | 2/5 · 0,81 | 3/5 · 0,78 | 2/5 · 0,90 |
| `pontos_de_atencao`: idêntico nas execuções · similaridade | 1/5 · 0,77 | 1/5 · 0,73 | 2/5 · 0,70 | 1/5 · 0,85 |
| `recomendacoes`: idêntico nas execuções · similaridade | 1/5 · 0,55 | 0/5 · 0,50 | 1/5 · 0,68 | 0/5 · 0,58 |
| `observacoes.instrucoes_em_dados`: idêntico nas execuções · similaridade | 5/5 · 1,00 | 5/5 · 1,00 | 5/5 · 1,00 | 5/5 · 1,00 |
| `observacoes.valores_atipicos`: idêntico nas execuções · similaridade | 5/5 · 1,00 | 4/5 · 0,93 | 4/5 · 0,87 | 4/5 · 0,91 |

## 5. Divergências nos textos

**Números citados sem lastro** (o modelo calculou ou inventou o valor):

Nenhum.

**Afirmações comparativas sobre um item sem dado por item** (ex.: "a despesa X foi mantida sob controle"; DADOS só traz o mês anterior em totais):

| Input | Execução | Campo | Frase |
| --- | --- | --- | --- |
| 02-agencia-prejuizo | 1 | `destaques_positivos[1]` | O controle de despesas com freelancers foi mantido em níveis adequados. |
| 02-agencia-prejuizo | 2 | `destaques_positivos[1]` | O controle de despesas com freelancers foi mantido em níveis adequados. |
| 02-agencia-prejuizo | 3 | `destaques_positivos[1]` | O controle de despesas com freelancers foi mantido em níveis adequados. |
| 04-saas-dolar-investidores | 1 | `pontos_de_atencao[2]` | A maior despesa continua sendo com pessoal, representando 55,9% da despesa total. |

## 6. Falhas de validação

Nenhuma falha.
