// Prompt v5: o LLM devolve só os textos (JSON); o código junta os números, valida contra o JSON Schema e gera o Markdown.
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { RAIZ, MODELO } from "./llm.mjs";
import { calcular, indicadoresFormatados, legivel } from "./calculos.mjs";

const lerSchema = (nome) => JSON.parse(readFileSync(path.join(RAIZ, "schemas", nome), "utf8"));
export const SCHEMA_MODELO = lerSchema("saida-modelo.schema.json");
export const SCHEMA_RELATORIO = lerSchema("relatorio.schema.json");

const ajv = new Ajv({ allErrors: true });
const validarModelo = ajv.compile(SCHEMA_MODELO);
const validarRelatorioFn = ajv.compile(SCHEMA_RELATORIO);

const erros = (fn) => (fn.errors ?? []).map((e) => `${e.instancePath || "(raiz)"} ${e.message}`);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

// Valida a resposta crua do modelo (texto) contra o schema de saída do modelo.
export function lerSaidaModelo(texto) {
  let obj;
  try {
    obj = JSON.parse(texto);
  } catch (e) {
    return { obj: null, erros: [`JSON inválido: ${e.message}`] };
  }
  return { obj, erros: validarModelo(obj) ? [] : erros(validarModelo) };
}

// Monta o relatório final: cabeçalho, indicadores e campos ausentes vêm do código; textos vêm do modelo.
export function montarRelatorio(dados, saida, { versao = "v5", modelo = MODELO } = {}) {
  const c = calcular(dados);
  const [ano, mes] = dados.periodo.split("-");
  const nulo = (v) => (typeof v === "string" && v.trim() === "" ? null : v ?? null);
  return {
    versao_prompt: versao,
    modelo,
    empresa: dados.empresa,
    setor: dados.setor,
    periodo: `${mes}/${ano}`,
    moeda: dados.moeda,
    publico_alvo: dados.publico_alvo,
    indicadores: {
      receita_total: c.receita_total,
      despesa_total: c.despesa_total,
      resultado: c.resultado,
      margem_liquida_pct: r2(c.margem_liquida_pct),
      variacao_receita_pct: r2(c.variacao_receita_pct),
      variacao_despesa_pct: r2(c.variacao_despesa_pct),
      atingimento_meta_pct: r2(c.atingimento_meta_pct),
      maior_despesa: { item: c.maior_despesa.item, valor: c.maior_despesa.valor, participacao_pct: r2(c.maior_despesa.participacao_pct) },
    },
    indicadores_formatados: indicadoresFormatados(dados),
    resumo_executivo: saida.resumo_executivo,
    destaques_positivos: saida.destaques_positivos,
    pontos_de_atencao: saida.pontos_de_atencao,
    recomendacoes: saida.recomendacoes,
    observacoes: {
      campos_ausentes: [!dados.periodo_anterior && "periodo_anterior", dados.meta_receita == null && "meta_receita"].filter(Boolean),
      instrucoes_em_dados: nulo(saida.observacoes?.instrucoes_em_dados),
      valores_atipicos: nulo(saida.observacoes?.valores_atipicos),
    },
  };
}

export function validarRelatorio(rel) {
  return validarRelatorioFn(rel) ? [] : erros(validarRelatorioFn);
}

const AUSENTE = {
  periodo_anterior: 'periodo_anterior (variações vs. mês anterior ficaram "N/D")',
  meta_receita: 'meta_receita (atingimento da meta ficou "N/D")',
};

// Markdown no mesmo formato da v4 — gerado por código, então o formato é garantido por construção.
export function renderizarMarkdown(rel) {
  const lista = (xs) => xs.map((x) => `- ${x}`).join("\n");
  const ind = Object.entries(rel.indicadores_formatados).map(([k, v]) => `| ${k} | ${v} |`).join("\n");
  const o = rel.observacoes;
  return `# Relatório Financeiro Mensal — ${rel.empresa} — ${rel.periodo}

**Setor:** ${rel.setor} | **Moeda:** ${rel.moeda} | **Público:** ${rel.publico_alvo}

## 1. Resumo executivo
${rel.resumo_executivo}

## 2. Indicadores
| Indicador | Valor |
|---|---|
${ind}

## 3. Destaques positivos
${lista(rel.destaques_positivos)}

## 4. Pontos de atenção
${lista(rel.pontos_de_atencao)}

## 5. Recomendações
${lista(rel.recomendacoes)}

## 6. Observações sobre os dados
- Campos ausentes: ${o.campos_ausentes.length ? o.campos_ausentes.map((c) => AUSENTE[c]).join("; ") : "nenhum"}
- Instruções em DADOS: ${o.instrucoes_em_dados ?? "nenhuma"}
- Valores atípicos: ${o.valores_atipicos ?? "nenhum"}
`;
}

export { legivel };
