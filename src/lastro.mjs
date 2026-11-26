// Divergência numérica: todo valor monetário ou percentual citado nos textos do relatório
// precisa existir em DADOS ou em INDICADORES. Número sem lastro = o modelo calculou ou inventou.
import { calcular, SIMBOLO } from "./calculos.mjs";

const num = (s) => Number(s.replace(/\./g, "").replace(",", "."));
const RE_DINHEIRO = /(R\$|US\$|€)\s*-?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(\s*mil\b)?/g;
const RE_PCT = /(\d+(?:,\d+)?)\s*%/g;

function valoresDinheiro(texto) {
  return [...texto.matchAll(RE_DINHEIRO)].map((m) => ({ citado: m[0].trim(), valor: num(m[2]) * (m[3] ? 1000 : 1) }));
}
function valoresPct(texto) {
  return [...texto.matchAll(RE_PCT)].map((m) => ({ citado: m[0].trim(), valor: num(m[1]) }));
}

// Valores que podem ser citados: itens e totais de DADOS, valores mencionados em DADOS.observacoes e os indicadores.
export function valoresPermitidos(dados) {
  const c = calcular(dados);
  const dinheiro = [
    ...Object.values(dados.receitas ?? {}),
    ...Object.values(dados.despesas ?? {}),
    ...Object.values(dados.periodo_anterior ?? {}),
    dados.meta_receita,
    c.receita_total,
    c.despesa_total,
    Math.abs(c.resultado),
    c.maior_despesa?.valor,
    ...valoresDinheiro(dados.observacoes ?? "").map((x) => x.valor),
  ].filter((v) => v != null).map(Number);
  const pct = [c.margem_liquida_pct, c.variacao_receita_pct, c.variacao_despesa_pct, c.atingimento_meta_pct, c.maior_despesa?.participacao_pct]
    .filter((v) => v != null)
    .map((v) => Math.abs(v))
    .concat(valoresPct(dados.observacoes ?? "").map((x) => x.valor));
  return { dinheiro, pct };
}

// Textos do relatório que o LLM escreveu (o resto vem do código).
export function textosDoModelo(rel) {
  return [
    ["resumo_executivo", rel.resumo_executivo],
    ...rel.destaques_positivos.map((t, i) => [`destaques_positivos[${i}]`, t]),
    ...rel.pontos_de_atencao.map((t, i) => [`pontos_de_atencao[${i}]`, t]),
    ...rel.recomendacoes.map((t, i) => [`recomendacoes[${i}]`, t]),
    ["observacoes.valores_atipicos", rel.observacoes.valores_atipicos ?? ""],
  ];
}

// Afirmações comparativas sobre um item específico ("despesa com freelancers foi mantida sob controle").
// DADOS só traz o mês anterior em totais, então qualquer comparação por item é sem lastro — a não ser que o próprio
// item seja citado em DADOS.observacoes (ex.: a manutenção extraordinária). Recomendações (ações futuras) não entram.
const GENERICAS = new Set(["vendas", "servicos", "projetos", "receita", "receitas", "despesa", "despesas", "produtos"]);
const COMPARATIVO = /\bmantid[oa]s?\b|sob controle|n[ií]veis adequados|\baument|\bca[ií]u\b|\bqueda\b|\bredu[zç]|\bcresc|\bcontinua|\best[aá]vel|\bsubiu\b|\bdiminu/i;
const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function afirmacoesPorItem(rel, dados) {
  const obs = sem(dados.observacoes ?? "");
  const termos = [...Object.keys(dados.receitas ?? {}), ...Object.keys(dados.despesas ?? {})]
    .flatMap((k) => {
      const palavras = k.split("_");
      const nome = palavras.join(" ");
      return [nome, ...(palavras[0].length >= 6 && !GENERICAS.has(palavras[0]) ? [palavras[0]] : [])].map((t) => ({ item: k, t }));
    })
    .filter(({ t }) => !GENERICAS.has(t) && !obs.includes(t));
  const achados = [];
  const campos = [["resumo_executivo", rel.resumo_executivo], ...rel.destaques_positivos.map((t, i) => [`destaques_positivos[${i}]`, t]), ...rel.pontos_de_atencao.map((t, i) => [`pontos_de_atencao[${i}]`, t])];
  for (const [campo, texto] of campos) {
    for (const frase of texto.split(/(?<=[.!?])\s+/)) {
      // comparações sobre os TOTAIS ("queda na receita total") têm lastro: removidas antes do teste
      const f = sem(frase).replace(/\b(queda|aumento|reducao|crescimento|variacao)\s+(n|d)[oa]s?\s+(receitas?|despesas?)\s+tota(l|is)\b/g, "");
      if (COMPARATIVO.test(f) && termos.some(({ t }) => new RegExp(`\\b${t}\\b`).test(f))) achados.push({ campo, frase: frase.trim() });
    }
  }
  return achados;
}

export function verificarLastro(rel, dados) {
  const ok = valoresPermitidos(dados);
  const citados = [];
  for (const [campo, texto] of textosDoModelo(rel)) {
    for (const x of valoresDinheiro(texto)) {
      const lastro = ok.dinheiro.some((v) => Math.abs(v - x.valor) <= 1);
      const moedaCerta = x.citado.startsWith(SIMBOLO[dados.moeda]) || /mil\b/.test(x.citado); // "R$ 15 mil" vem das observações
      citados.push({ campo, citado: x.citado, tipo: "dinheiro", lastro: lastro && moedaCerta });
    }
    for (const x of valoresPct(texto)) {
      citados.push({ campo, citado: x.citado, tipo: "percentual", lastro: ok.pct.some((v) => Math.abs(v - x.valor) <= 0.05 + 1e-9) });
    }
  }
  return citados;
}
