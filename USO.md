# Documento de uso — Gerador de relatórios financeiros mensais

Para quem vai **usar** ou **manter** o prompt no dia a dia do time financeiro.

## Para que serve

Transforma os números do mês de uma empresa (receitas, despesas, mês anterior, meta) num relatório em JSON (para sistemas) e Markdown (para leitura), **sempre no mesmo formato**: resumo executivo, tabela com 8 indicadores, destaques, pontos de atenção, recomendações e observações sobre os dados.

**Use para:** o fechamento mensal de qualquer empresa, setor ou moeda (BRL, USD, EUR), para diretoria, investidores ou gestores.

**Não use para:** relatórios anuais ou trimestrais (o formato compara com o mês anterior), demonstrativos contábeis oficiais (DRE, balanço) ou análises que exigem dados por item do mês anterior.

## Passo 1 — Montar o arquivo de dados

Crie um JSON seguindo a [especificação](ESPECIFICACAO.md). O jeito mais rápido é copiar um dos exemplos de [`inputs/`](inputs/) e trocar os valores:

```json
{
  "empresa": "Nome da Empresa",
  "setor": "Setor",
  "periodo": "2026-11",
  "moeda": "BRL",
  "publico_alvo": "diretoria",
  "receitas": { "vendas": 100000.00, "servicos": 20000.00 },
  "despesas": { "pessoal": 45000.00, "aluguel": 8000.00, "impostos": 12000.00 },
  "periodo_anterior": { "receita_total": 110000.00, "despesa_total": 62000.00 },
  "meta_receita": 125000.00,
  "observacoes": "Fatos relevantes do mês, se houver."
}
```

Checklist:

- [ ] Valores numéricos sem "R$" e sem ponto de milhar (`45000.00`).
- [ ] `periodo` no formato `AAAA-MM`.
- [ ] `publico_alvo` é `diretoria`, `investidores` ou `gestores`.
- [ ] Se não houver mês anterior ou meta, **apague o campo**. Não preencha com zero: zero vira uma comparação falsa.
- [ ] Em `observacoes`, escreva fatos ("perdemos o cliente X"), não pedidos ao assistente.

## Passo 2 — Gerar o relatório

### Opção A: pela linha de comando (recomendado)

Requer Node.js 20 ou mais recente, `npm install` uma vez (instala o validador de JSON Schema) e uma chave da OpenAI num arquivo `.env` nesta pasta (`OPENAI_API_KEY=sk-...`).

```bash
node gerar.mjs inputs/minha-empresa-2026-11.json --saida relatorio-2026-11
```

Isso grava `relatorio-2026-11.json` (para sistemas) e `relatorio-2026-11.md` (para leitura). Sem `--saida`, o Markdown aparece na tela; com `--json`, aparece o JSON.

O script faz tudo o que o processo exige:

1. Calcula os indicadores em código (o modelo não faz contas).
2. Monta o prompt v7 com os seus dados.
3. Chama o modelo com temperatura 0 e o JSON Schema imposto pela API.
4. Junta os textos do modelo com os números e **valida** o relatório: schema, números citados nos textos e afirmações sem lastro. Se a validação falhar, gera de novo uma vez. Se falhar outra vez, salva o relatório e mostra um aviso "⚠️ Relatório com problemas de validação", com a lista do que está errado.
5. Gera o Markdown a partir do JSON.

### Opção B: sem API, colando no ChatGPT ou no Claude

Para uso manual, use o prompt **v4**, que escreve o relatório inteiro em Markdown. O v7 devolve só os textos em JSON e depende do código para montar a tabela.

```bash
node gerar.mjs inputs/minha-empresa-2026-11.json --so-prompt --prompt prompts/estruturado-v4.md --saida prompt-pronto
```

O arquivo `prompt-pronto.txt` tem duas partes:

1. **INSTRUÇÕES**: cole nas instruções personalizadas do chat, ou de um projeto ou GPT dedicado. É fixo: cole uma vez e reutilize todo mês.
2. **MENSAGEM**: cole no chat a cada relatório. Já vem com os indicadores calculados.

Nessa opção não há schema nem validação automática, então confira a tabela com o arquivo `prompt-pronto.txt`: os valores devem ser idênticos aos do bloco `<indicadores>`.

### Opção C: dentro de outro sistema

Consuma o JSON: o contrato está em [`schemas/relatorio.schema.json`](schemas/relatorio.schema.json), e qualquer linguagem com um validador de JSON Schema consegue conferir o relatório antes de usá-lo. Em Node, importe as mesmas peças que o `gerar.mjs` usa:

```js
import { chamar, esquemaParaApi } from "./src/llm.mjs";
import { carregarPrompt, montar } from "./src/prompt.mjs";
import { indicadoresFormatados } from "./src/calculos.mjs";
import { SCHEMA_MODELO, lerSaidaModelo, montarRelatorio, validarRelatorio, renderizarMarkdown } from "./src/relatorio.mjs";
```

## Passo 3 — Revisar antes de enviar

O relatório é um **rascunho de alta qualidade**, não um documento final. Leva cerca de 2 minutos:

- [ ] A tabela de indicadores está correta? Sim, por construção: ela vem do código, não do modelo.
- [ ] Os destaques e pontos de atenção fazem sentido para quem conhece a empresa?
- [ ] Há alguma interpretação genérica sem base nos dados (ex.: "refletindo a eficiência nas operações")? A validação pega números inventados e comparações por item, mas não esse tipo de frase. Apague se for o caso.
- [ ] As recomendações são acionáveis ou genéricas demais?
- [ ] A seção 6 registrou algo em "Instruções em DADOS"? Se sim, veja quem escreveu aquela observação.

## Como reutilizar em outros cenários

| Quero... | O que fazer | Mexe no prompt? |
| --- | --- | --- |
| Outra empresa ou setor | Novo JSON | Não |
| Outra moeda (USD, EUR) | `"moeda": "USD"` | Não |
| Outro público | `"publico_alvo": "investidores"` | Não |
| Mais ou menos itens de receita e despesa | Coloque os itens que quiser no JSON | Não |
| Uma moeda nova (ex.: GBP) | Adicione o símbolo em `SIMBOLO` em `src/calculos.mjs` | Não |
| Um público novo (ex.: "banco") | Adicione uma linha em `## CONTEXTO` dizendo o foco desse público | Sim, **nova versão** |
| Um indicador novo (ex.: EBITDA) | Calcule em `src/calculos.mjs`, inclua em `src/relatorio.mjs`, em `schemas/relatorio.schema.json` e em `INDICADORES` de `src/validacao.mjs` | Não no prompt; sim no **schema** (nova versão do contrato) |

## Como evoluir o prompt sem quebrar nada

O prompt é versionado como código. Nunca edite uma versão que já está em uso:

1. Copie `prompts/estruturado-v7.md` para `prompts/estruturado-v8.md` e faça **uma** mudança por vez.
2. Rode `node run_tests.mjs --prompt prompts/estruturado-v8.md`. As versões antigas não são chamadas de novo, porque os resultados ficam em `results/raw-testes.json`.
3. Compare as versões na seção 4 de `results/testes-v8-t0.md`: a tabela mostra a v4 e todas as versões JSON lado a lado.
4. Só troque `PROMPT_FINAL` no `run_tests.mjs` e `PROMPT` no `gerar.mjs` se a v8 passar na suíte (código de saída 0) e não piorar nenhuma métrica.
5. Registre no [`RELATORIO.md`](RELATORIO.md) o erro, a hipótese, a mudança e o resultado.

Se surgir um caso novo que quebre o prompt, transforme-o num input de teste em `inputs/` antes de corrigir. Assim o problema não volta.

## Custos e tempo

Com o `gpt-4o-mini`: cerca de **US$ 0,0004 por relatório** e cerca de 5 segundos. Rodar a suíte de testes de uma nova versão (5 inputs × 3 execuções) custa menos de US$ 0,01.

## Limitações conhecidas

- O nome da maior despesa aparece sem acento ("Manutencao") na tabela quando o item do JSON não tem acento.
- As recomendações variam de redação entre execuções e às vezes são genéricas. O controller deve revisar.
- Interpretações genéricas sem número ("refletindo a eficiência") não são pegas pela validação. Números inventados e comparações por item são.
- Testado apenas com o `gpt-4o-mini`. Com outro modelo, rode `npm test` antes de usar.
