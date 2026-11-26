// Cálculo determinístico dos indicadores (fonte da verdade para validar a IA).
const soma = (o) => Object.values(o ?? {}).reduce((a, b) => a + Number(b), 0);
const r2 = (v) => Math.round(v * 100) / 100;

export const SIMBOLO = { BRL: "R$", USD: "US$", EUR: "€" };

export function calcular(d) {
  const receita = r2(soma(d.receitas));
  const despesa = r2(soma(d.despesas));
  const resultado = r2(receita - despesa);
  const ant = d.periodo_anterior ?? {};
  const [item, valor] = Object.entries(d.despesas ?? {}).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return {
    receita_total: receita,
    despesa_total: despesa,
    resultado,
    margem_liquida_pct: receita ? (resultado / receita) * 100 : null,
    variacao_receita_pct: ant.receita_total ? ((receita - ant.receita_total) / ant.receita_total) * 100 : null,
    variacao_despesa_pct: ant.despesa_total ? ((despesa - ant.despesa_total) / ant.despesa_total) * 100 : null,
    atingimento_meta_pct: d.meta_receita ? (receita / d.meta_receita) * 100 : null,
    maior_despesa: item ? { item, valor, participacao_pct: (valor / despesa) * 100 } : null,
  };
}

export function fmtDinheiro(v, moeda) {
  const s = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? "-" : ""}${SIMBOLO[moeda] ?? moeda} ${s}`;
}

export function fmtPct(v, sinal = false) {
  if (v == null) return "N/D";
  const s = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${v < 0 ? "-" : sinal ? "+" : ""}${s}%`;
}

export function legivel(item) {
  const t = item.replace(/_/g, " ");
  return t[0].toUpperCase() + t.slice(1);
}

// Indicadores já formatados, na ordem da tabela do relatório.
export function indicadoresFormatados(d) {
  const c = calcular(d);
  return {
    "Receita total": fmtDinheiro(c.receita_total, d.moeda),
    "Despesa total": fmtDinheiro(c.despesa_total, d.moeda),
    Resultado: fmtDinheiro(c.resultado, d.moeda),
    "Margem líquida": fmtPct(c.margem_liquida_pct),
    "Variação da receita vs. mês anterior": fmtPct(c.variacao_receita_pct, true),
    "Variação da despesa vs. mês anterior": fmtPct(c.variacao_despesa_pct, true),
    "Atingimento da meta de receita": fmtPct(c.atingimento_meta_pct),
    "Maior despesa": c.maior_despesa ? `${legivel(c.maior_despesa.item)} (${fmtPct(c.maior_despesa.participacao_pct)} da despesa total)` : "N/D",
  };
}

// Campos opcionais ausentes e o indicador afetado (checagem determinística, feita em código).
export function camposAusentes(d) {
  const out = [];
  if (!d.periodo_anterior) out.push('periodo_anterior ausente: "Variação da receita vs. mês anterior" e "Variação da despesa vs. mês anterior" ficaram N/D.');
  if (d.meta_receita == null) out.push('meta_receita ausente: "Atingimento da meta de receita" ficou N/D.');
  return out;
}
