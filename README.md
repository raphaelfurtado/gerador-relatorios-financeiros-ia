# Gerador de relatórios financeiros com IA

Micro-capstone da Disciplina 01 do Módulo 02 (Engenharia de Prompt Avançada): um prompt estruturado que funciona como **função reutilizável**, transformando os dados do mês de uma empresa num relatório financeiro sempre no mesmo formato, em **JSON** (para sistemas) e **Markdown** (para pessoas).

```
gerar_relatorio(dados_do_mes.json) → relatorio.json (válido em schemas/relatorio.schema.json) + relatorio.md
```

## Resultado em uma tabela

15 relatórios por configuração (5 empresas × 3 execuções), modelo `gpt-4o-mini`, validados por código ([`results/testes-v7-t0.md`](results/testes-v7-t0.md)):

| | Prompt genérico | Prompt final (v7) |
| --- | --- | --- |
| Válidos no formato / no JSON Schema | 0/15 | **15/15** |
| Campos obrigatórios presentes | — | **210/210** |
| Estruturas diferentes entre os 15 relatórios | 15 | **1** |
| Indicadores corretos | sem tabela; resultado certo em 10/15 | **15/15** (diferença máx. 0,00) |
| Números citados nos textos que existem nos dados | — | **111/111** |
| Obedeceu a instrução maliciosa escondida nos dados | **3/3** ("lucro recorde" num prejuízo de R$ 130 mil) | 0/3, e registrou a tentativa |
| Números, estrutura e decisões iguais nas 3 execuções | 0/5 inputs | **5/5 inputs** |

O caminho até lá passou por 7 versões:

- A **v1** tinha formato perfeito e **errou as contas em 100% dos casos**. A maior melhoria foi calcular os números em código e deixar o modelo só interpretar e redigir.
- Da **v5** em diante, o formato deixou de depender de o modelo obedecer: a API impõe o JSON Schema na geração e o Markdown é montado por código.

A análise completa está no [RELATORIO.md](RELATORIO.md).

## Entregáveis

| Entregável pedido | Onde está |
| --- | --- |
| Prompt final estruturado | [`prompts/estruturado-v7.md`](prompts/estruturado-v7.md) |
| Especificação de input e output (com JSON Schema) | [`ESPECIFICACAO.md`](ESPECIFICACAO.md) e [`schemas/`](schemas/) |
| 5 exemplos de execução | [`EXEMPLOS.md`](EXEMPLOS.md) (input, JSON e Markdown de cada um) |
| Documento de uso do prompt | [`USO.md`](USO.md) |
| As 4 partes e o papel, com a justificativa de papel, contexto e formato | [`RELATORIO.md`](RELATORIO.md), seção 2 |
| Comparação não estruturado × estruturado | [`RELATORIO.md`](RELATORIO.md), seção 4 |
| Versões do prompt (erro → hipótese → mudança → resultado) | [`RELATORIO.md`](RELATORIO.md), seção 5, e [`prompts/`](prompts/) |
| Consistência medida: conformidade com o schema e variabilidade por campo | [`RELATORIO.md`](RELATORIO.md), seção 6, e [`results/testes-v7-t0.md`](results/testes-v7-t0.md) |

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `prompts/estruturado-v7.md` | **Prompt final** |
| `prompts/nao-estruturado.md`, `estruturado-v1.md` a `v6.md` | Baseline e versões anteriores (histórico do ciclo de refinamento) |
| `schemas/saida-modelo.schema.json` | O que o modelo devolve; enviado à API como structured output (strict) |
| `schemas/relatorio.schema.json` | Contrato do relatório final, para integração |
| `inputs/*.json` | Os 5 cenários de teste |
| `gerar.mjs` | **A função**: gera o relatório (JSON e Markdown) de um arquivo de dados, ou só monta o prompt para colar no ChatGPT |
| `run_tests.mjs` | **Suíte de testes da versão final**: 3 execuções por input, schema, campos presentes, divergência numérica e variabilidade por campo; sai com código 1 se falhar |
| `run.mjs` | Suíte da fase 1 (prompt genérico e v1 a v4, em Markdown) |
| `src/calculos.mjs` | Cálculo dos indicadores e detecção de campos ausentes (determinístico) |
| `src/relatorio.mjs` | Monta o relatório final, valida contra o schema (Ajv) e gera o Markdown |
| `src/lastro.mjs` | Divergência numérica e afirmações sem lastro nos textos |
| `src/validacao.mjs` · `src/casos.mjs` | Validação do Markdown e verificações específicas de cada cenário |
| `src/prompt.mjs` · `src/llm.mjs` | Montagem do prompt (sistema × dados) e chamada à API |
| `outputs/` | As 180 respostas do modelo, por versão. O [guia da pasta](outputs/README.md) indica o que é baseline e o que é final |
| `results/` | Métricas: `testes-v7-t0.md`/`.json` (final), `testes-v5`/`v6`, `tabelas.md` (fase 1) e dados brutos |

## Rodar

Requer Node.js 20 ou mais recente e uma chave da OpenAI (`.env` nesta pasta com `OPENAI_API_KEY=sk-...`).

```bash
npm install                                                 # instala o Ajv (validador de JSON Schema)
node gerar.mjs inputs/01-padaria-lucro.json                 # relatório em Markdown na tela
node gerar.mjs inputs/01-padaria-lucro.json --json          # relatório em JSON na tela
node gerar.mjs inputs/01-padaria-lucro.json --saida rel     # grava rel.json e rel.md
node gerar.mjs inputs/01-padaria-lucro.json --so-prompt     # só monta o prompt, para colar no ChatGPT
npm test                                                    # suíte da versão final (run_tests.mjs)
node run_tests.mjs --so-relatorio                           # recalcula as métricas sem chamar a API
```
