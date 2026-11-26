# Documento de uso — Gerador de relatórios financeiros mensais

Para quem vai **usar** ou **manter** o prompt no dia a dia do time financeiro.

## Para que serve

Transforma os números do mês de uma empresa (receitas, despesas, mês anterior, meta) num relatório em Markdown, **sempre no mesmo formato**: resumo executivo, tabela com 8 indicadores, destaques, pontos de atenção, recomendações e observações sobre os dados.

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

Requer Node.js 20 ou mais recente e uma chave da OpenAI num arquivo `.env` nesta pasta (`OPENAI_API_KEY=sk-...`).

```bash
node gerar.mjs inputs/minha-empresa-2026-11.json --saida relatorio-2026-11.md
```

O script faz tudo o que o processo exige:

1. Calcula os indicadores em código (o modelo não faz contas).
2. Monta o prompt v4 com os seus dados.
3. Chama o modelo com temperatura 0.
4. **Valida** a saída: formato, números e observações. Se a validação falhar, gera de novo uma vez. Se falhar outra vez, salva o relatório e mostra um aviso "⚠️ Relatório com problemas de validação", com a lista do que está errado.

### Opção B: sem API, colando no ChatGPT ou no Claude

```bash
node gerar.mjs inputs/minha-empresa-2026-11.json --so-prompt --saida prompt-pronto.txt
```

O arquivo gerado tem duas partes:

1. **INSTRUÇÕES**: cole nas instruções personalizadas do chat, ou de um projeto ou GPT dedicado. É fixo: cole uma vez e reutilize todo mês.
2. **MENSAGEM**: cole no chat a cada relatório. Já vem com os indicadores calculados.

Nessa opção não há validação automática, então confira a tabela com o arquivo `prompt-pronto.txt`: os valores devem ser idênticos aos do bloco `<indicadores>`.

### Opção C: dentro de outro sistema

Importe as mesmas peças que o `gerar.mjs` usa:

```js
import { carregarPrompt, montar } from "./src/prompt.mjs";
import { indicadoresFormatados, camposAusentes } from "./src/calculos.mjs";
import { validarEstruturado, observacoesCoerentes } from "./src/validacao.mjs";
```

## Passo 3 — Revisar antes de enviar

O relatório é um **rascunho de alta qualidade**, não um documento final. Leva cerca de 2 minutos:

- [ ] A tabela de indicadores está correta? Se passou na validação, sim: foi conferida por código.
- [ ] Os destaques e pontos de atenção fazem sentido para quem conhece a empresa?
- [ ] Há alguma afirmação sem base nos dados? Os testes mostraram que o modelo às vezes escreve coisas como "a despesa X foi mantida sob controle" sem ter dado do mês anterior por item. Apague se for o caso.
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
| Um indicador novo (ex.: EBITDA) | Calcule em `src/calculos.mjs`, adicione a linha no formato do prompt e em `INDICADORES` de `src/validacao.mjs` | Sim, **nova versão** |

## Como evoluir o prompt sem quebrar nada

O prompt é versionado como código. Nunca edite uma versão que já está em uso:

1. Copie `prompts/estruturado-v4.md` para `prompts/estruturado-v5.md` e faça **uma** mudança por vez.
2. Adicione a configuração em `CONFIGS` no `run.mjs` (`v5-t0`, temperatura 0).
3. Rode `node run.mjs`. As versões antigas não são chamadas de novo, porque os resultados ficam em `results/raw.json`.
4. Compare `v5-t0` com `v4-t0` em `results/tabelas.md`. Só troque `FINAL` no `run.mjs` e `PROMPT_PADRAO` no `gerar.mjs` se a v5 não piorar nenhuma métrica.
5. Registre no [`RELATORIO.md`](RELATORIO.md) o erro, a hipótese, a mudança e o resultado.

Se surgir um caso novo que quebre o prompt, transforme-o num input de teste em `inputs/` antes de corrigir. Assim o problema não volta.

## Custos e tempo

Com o `gpt-4o-mini`: cerca de **US$ 0,0005 por relatório** e cerca de 6 segundos. Rodar a suíte completa de testes de uma nova versão (2 temperaturas × 5 inputs × 3 execuções) custa menos de US$ 0,02.

## Limitações conhecidas

- O nome da maior despesa aparece sem acento ("Manutencao") quando o item do JSON não tem acento.
- As recomendações às vezes são genéricas. O controller deve revisar.
- Afirmações qualitativas sobre itens individuais não são verificadas pelo validador, só os números.
- Testado apenas com o `gpt-4o-mini`. Com outro modelo, rode a suíte de testes antes de usar.
