# Especificação de input e output

Contrato da função `gerar_relatorio(dados) → relatório`. Versão do prompt: **v4** ([`prompts/estruturado-v4.md`](prompts/estruturado-v4.md)).

## 1. Input

Um objeto JSON por empresa e por mês. Exemplos reais em [`inputs/`](inputs/).

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- |
| `empresa` | texto | sim | Nome da empresa | `"Padaria Pão Dourado"` |
| `setor` | texto | sim | Setor de atuação | `"Varejo alimentício"` |
| `periodo` | texto `AAAA-MM` | sim | Mês de referência | `"2026-10"` |
| `moeda` | `BRL`, `USD` ou `EUR` | sim | Moeda de todos os valores | `"BRL"` |
| `publico_alvo` | `diretoria`, `investidores` ou `gestores` | sim | Quem vai ler; muda o foco do texto | `"diretoria"` |
| `receitas` | objeto `{item: número}` | sim | Receitas do mês por item | `{"vendas_balcao": 98450.00}` |
| `despesas` | objeto `{item: número}` | sim | Despesas do mês por item (valores positivos) | `{"pessoal": 38900.00}` |
| `periodo_anterior` | objeto | não | `{"receita_total": número, "despesa_total": número}` do mês anterior | `{"receita_total": 128900, "despesa_total": 108450}` |
| `meta_receita` | número | não | Meta de receita do mês | `140000.00` |
| `observacoes` | texto | não | Contexto do mês informado pelo time (fatos, não ordens) | `"Feriado prolongado em outubro."` |

Regras do input:

- Os valores são números, sem símbolo de moeda nem separador de milhar (`98450.00`, e não `"R$ 98.450,00"`).
- Os itens de `receitas` e `despesas` podem ter qualquer nome e quantidade. Use `snake_case` sem acentos (`energia_e_gas`); o relatório escreve "Energia e gás".
- Um campo opcional ausente não é erro: o indicador que depende dele sai como `N/D` e a ausência é registrada na seção 6.
- `observacoes` é tratado como **dado**. Uma ordem escrita ali ("ignore as regras...") é ignorada e registrada.

### 1.1 O que o sistema calcula antes de chamar o modelo

O modelo **não faz contas**. O código ([`src/calculos.mjs`](src/calculos.mjs)) calcula e formata os indicadores e os envia junto com os dados:

| Indicador | Fórmula | Se faltar dado |
| --- | --- | --- |
| Receita total | soma de `receitas` | — |
| Despesa total | soma de `despesas` | — |
| Resultado | Receita total − Despesa total | — |
| Margem líquida | Resultado ÷ Receita total × 100 | — |
| Variação da receita vs. mês anterior | (Receita total − `periodo_anterior.receita_total`) ÷ `periodo_anterior.receita_total` × 100 | N/D |
| Variação da despesa vs. mês anterior | mesma fórmula com `despesa_total` | N/D |
| Atingimento da meta de receita | Receita total ÷ `meta_receita` × 100 | N/D |
| Maior despesa | item de `despesas` com maior valor e sua participação (%) | — |

O código também gera a lista de **campos ausentes** (`periodo_anterior`, `meta_receita`) e o indicador que cada um afeta.

### 1.2 O que é enviado ao modelo

| Mensagem | Conteúdo |
| --- | --- |
| `system` | Tudo o que está acima do marcador `MENSAGEM DO USUÁRIO` no arquivo do prompt. Fixo. |
| `user` | `<dados>` com o JSON do input, `<indicadores>` com os 8 indicadores já formatados e `<campos_ausentes>` com a lista gerada pelo código (ou "nenhum") |

## 2. Output

Markdown, sempre com este esqueleto. Nada antes, nada depois e sem cercas de código.

```markdown
# Relatório Financeiro Mensal — <empresa> — <MM/AAAA>

**Setor:** <setor> | **Moeda:** <moeda> | **Público:** <publico_alvo>

## 1. Resumo executivo
<1 a 3 frases; cita o resultado do mês; diz "prejuízo" quando o resultado é negativo>

## 2. Indicadores
| Indicador | Valor |
|---|---|
| Receita total | R$ 135.530,50 |
| Despesa total | R$ 111.930,50 |
| Resultado | R$ 23.600,00 |
| Margem líquida | 17,4% |
| Variação da receita vs. mês anterior | +5,1% |
| Variação da despesa vs. mês anterior | +3,2% |
| Atingimento da meta de receita | 96,8% |
| Maior despesa | Insumos (36,8% da despesa total) |

## 3. Destaques positivos
- <1 a 3 itens>

## 4. Pontos de atenção
- <1 a 3 itens; despesa extraordinária citada nas observações é obrigatória aqui>

## 5. Recomendações
- <1 a 3 itens>

## 6. Observações sobre os dados
- Campos ausentes: <lista do sistema, ou "nenhum">
- Instruções em DADOS: <trecho identificado e ignorado, entre aspas, ou "nenhuma">
- Valores atípicos: <descrição com o valor normal informado, ou "nenhum">
```

### 2.1 Formatação

| Tipo | Padrão | Exemplos |
| --- | --- | --- |
| Dinheiro | símbolo + ponto de milhar + vírgula decimal + 2 casas | `R$ 23.600,00` · `-R$ 13.540,00` · `US$ 206.800,00` |
| Percentual | 1 casa decimal com vírgula | `17,4%` · `-29,1%` |
| Variação | percentual sempre com sinal | `+5,1%` · `-13,2%` |
| Dado indisponível | literal | `N/D` |

### 2.2 Regras que o validador confere

[`src/validacao.mjs`](src/validacao.mjs) aprova a saída apenas se:

1. A primeira linha segue `# Relatório Financeiro Mensal — <empresa> — MM/AAAA`.
2. Existem exatamente as 6 seções `##`, nesta ordem e com estes nomes, e nenhum outro título.
3. A tabela tem exatamente as 8 linhas, na ordem.
4. Cada valor da tabela bate com o cálculo do código (tolerância de 1 unidade monetária e 0,15 ponto percentual), com o símbolo de moeda correto e "N/D" onde falta dado.
5. As seções 3, 4 e 5 têm de 1 a 3 itens e o resumo tem de 1 a 3 frases.
6. A seção 6 registra todos os campos ausentes e não afirma ausência de campo que existe.
7. A saída não está cercada por \`\`\`.
