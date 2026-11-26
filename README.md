# Gerador de relatórios financeiros com IA

Micro-capstone da Disciplina 01 do Módulo 02 (Engenharia de Prompt Avançada): um prompt estruturado que funciona como **função reutilizável**, transformando os dados do mês de uma empresa num relatório financeiro sempre no mesmo formato.

```
gerar_relatorio(dados_do_mes.json) → relatório em Markdown padronizado
```

## Resultado em uma tabela

15 relatórios por configuração (5 empresas × 3 execuções), modelo `gpt-4o-mini`, validados por código:

| | Prompt genérico | Prompt final (v4) |
| --- | --- | --- |
| Formato padrão | 0/15 | **15/15** |
| Estruturas diferentes entre os 15 relatórios | 15 | **1** |
| Números corretos | sem tabela; resultado certo em 10/15 | **15/15** |
| Obedeceu a instrução maliciosa escondida nos dados | **3/3** ("lucro recorde" num prejuízo de R$ 130 mil) | 0/3, e registrou a tentativa |
| Similaridade entre execuções (1 = idênticas) | 0,50 | **0,85** |

O caminho até lá passou por 4 versões. A v1 tinha formato perfeito e **errou as contas em 100% dos casos**. A maior melhoria foi calcular os números em código e deixar o modelo só interpretar e redigir. A análise completa está no [RELATORIO.md](RELATORIO.md).

## Entregáveis

| Entregável pedido | Onde está |
| --- | --- |
| Prompt final estruturado | [`prompts/estruturado-v4.md`](prompts/estruturado-v4.md) |
| Especificação de input e output | [`ESPECIFICACAO.md`](ESPECIFICACAO.md) |
| 5 exemplos de execução | [`EXEMPLOS.md`](EXEMPLOS.md) (gerado pelos testes) |
| Documento de uso do prompt | [`USO.md`](USO.md) |
| As 4 partes e o papel, com a justificativa de papel, contexto e formato | [`RELATORIO.md`](RELATORIO.md), seção 2 |
| Comparação não estruturado × estruturado | [`RELATORIO.md`](RELATORIO.md), seção 4 |
| Análise de variabilidade | [`RELATORIO.md`](RELATORIO.md), seção 6 |
| Versões do prompt (erro → hipótese → mudança) | [`RELATORIO.md`](RELATORIO.md), seção 5, e [`prompts/`](prompts/) |

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `prompts/nao-estruturado.md` | Prompt genérico (baseline) |
| `prompts/estruturado-v1.md` a `v4.md` | As 4 versões do prompt estruturado; a v4 é a final |
| `inputs/*.json` | Os 5 cenários de teste |
| `src/calculos.mjs` | Cálculo dos indicadores e detecção de campos ausentes (determinístico) |
| `src/validacao.mjs` | Validação de formato e números, e métricas de variabilidade |
| `src/casos.mjs` | O que cada cenário prova e as verificações específicas dele |
| `src/prompt.mjs` · `src/llm.mjs` | Montagem do prompt (sistema × dados) e chamada à API |
| `gerar.mjs` | **A função**: gera o relatório de um JSON (ou só monta o prompt para colar no ChatGPT) |
| `run.mjs` | Suíte de testes: todas as versões × 5 inputs × 3 execuções; gera as tabelas e o EXEMPLOS.md |
| `outputs/<configuração>/` | As 135 respostas do modelo |
| `results/tabelas.md` | Todas as métricas, por configuração e por input, e a lista de falhas |
| `results/raw.json` | Dados brutos (texto, tokens, latência) |

## Rodar

Requer Node.js 20 ou mais recente e uma chave da OpenAI (`.env` nesta pasta com `OPENAI_API_KEY=sk-...`; se não houver, o script usa o `.env.local` do `assistente-rl` ao lado).

```bash
node gerar.mjs inputs/01-padaria-lucro.json               # gera um relatório (prompt v4, temperatura 0, com validação)
node gerar.mjs inputs/01-padaria-lucro.json --so-prompt   # só monta o prompt, para colar no ChatGPT
node run.mjs                                              # roda os testes que faltam e regenera tabelas e exemplos
node run.mjs --so-relatorio                               # só recalcula as tabelas a partir de results/raw.json
```
