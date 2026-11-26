// Validação automática das saídas: formato, números e similaridade entre execuções.
import { calcular, SIMBOLO } from "./calculos.mjs";

export const SECOES = [
  "1. Resumo executivo",
  "2. Indicadores",
  "3. Destaques positivos",
  "4. Pontos de atenção",
  "5. Recomendações",
  "6. Observações sobre os dados",
];
export const INDICADORES = [
  "Receita total",
  "Despesa total",
  "Resultado",
  "Margem líquida",
  "Variação da receita vs. mês anterior",
  "Variação da despesa vs. mês anterior",
  "Atingimento da meta de receita",
  "Maior despesa",
];

export const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[_\s-]+/g, " ").trim();

export function secoes(md) {
  const out = {};
  let atual = null;
  for (const l of md.split(/\r?\n/)) {
    const m = l.match(/^##\s+(.*)$/);
    if (m) { atual = m[1].trim(); out[atual] = []; continue; }
    if (atual) out[atual].push(l);
  }
  return out;
}

// Títulos markdown (#, ##, ###...) na ordem em que aparecem, sem a linha do título principal.
export function estrutura(md) {
  return md.split(/\r?\n/).filter((l) => /^#{2,6}\s/.test(l.trim())).map((l) => l.trim());
}

export function linhasDaTabela(md) {
  return (secoes(md)["2. Indicadores"] ?? [])
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"))
    .slice(2)
    .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim().replace(/\*\*/g, "")));
}

// Primeiro número da célula, no padrão brasileiro (1.234,56). Sinal negativo se houver "-" antes do número.
export function numero(celula) {
  const m = celula.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/);
  if (!m) return null;
  const v = Number(m[0].replace(/\./g, "").replace(",", "."));
  return /[-−–]/.test(celula.slice(0, m.index)) ? -v : v;
}

export function validarEstruturado(md, dados) {
  const formato = [];
  const numeros = [];
  const txt = md.trim();
  const linhas = txt.split(/\r?\n/);

  if (txt.startsWith("```")) formato.push("saída cercada por ```");
  if (!/^# Relatório Financeiro Mensal — .+ — \d{2}\/\d{4}$/.test(linhas[0].trim())) formato.push(`título fora do padrão: "${linhas[0].trim()}"`);
  const hs = linhas.filter((l) => /^##\s/.test(l)).map((l) => l.replace(/^##\s+/, "").trim());
  if (JSON.stringify(hs) !== JSON.stringify(SECOES)) formato.push(`seções fora do padrão: ${hs.join(" | ")}`);
  const outrosTitulos = linhas.filter((l) => /^(#|###+)\s/.test(l)).length - 1;
  if (outrosTitulos > 0) formato.push(`${outrosTitulos} título(s) extra(s)`);

  const tab = linhasDaTabela(txt);
  const nomes = tab.map((r) => r[0]);
  if (JSON.stringify(nomes) !== JSON.stringify(INDICADORES)) formato.push(`linhas da tabela fora do padrão: ${nomes.join(" | ")}`);

  const s = secoes(txt);
  for (const sec of SECOES.slice(2, 5)) {
    const n = (s[sec] ?? []).filter((l) => /^\s*-\s/.test(l)).length;
    if (n < 1 || n > 3) formato.push(`"${sec}" com ${n} itens (esperado 1 a 3)`);
  }
  const resumo = (s["1. Resumo executivo"] ?? []).join(" ").trim();
  const frases = resumo ? resumo.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).length : 0;
  if (frases < 1 || frases > 3) formato.push(`resumo com ${frases} frases (máx. 3)`);

  // Números: compara com o cálculo determinístico.
  const c = calcular(dados);
  const esperado = [
    ["Receita total", c.receita_total, 1, true],
    ["Despesa total", c.despesa_total, 1, true],
    ["Resultado", c.resultado, 1, true],
    ["Margem líquida", c.margem_liquida_pct, 0.15],
    ["Variação da receita vs. mês anterior", c.variacao_receita_pct, 0.15],
    ["Variação da despesa vs. mês anterior", c.variacao_despesa_pct, 0.15],
    ["Atingimento da meta de receita", c.atingimento_meta_pct, 0.15],
    ["Maior despesa", c.maior_despesa?.participacao_pct ?? null, 0.15],
  ];
  for (const [nome, valor, tol, dinheiro] of esperado) {
    const linha = tab.find((r) => r[0] === nome);
    if (!linha) { numeros.push(`${nome}: linha ausente`); continue; }
    const cel = linha[1] ?? "";
    if (valor == null) {
      if (!/^N\/D/.test(cel)) numeros.push(`${nome}: esperado N/D, veio "${cel}"`);
      continue;
    }
    const v = numero(cel);
    if (v == null || Math.abs(v - valor) > tol) numeros.push(`${nome}: esperado ${valor.toFixed(2)}, veio "${cel}"`);
    if (dinheiro && !cel.includes(SIMBOLO[dados.moeda])) numeros.push(`${nome}: sem o símbolo ${SIMBOLO[dados.moeda]} ("${cel}")`);
  }
  const md_ = tab.find((r) => r[0] === "Maior despesa");
  if (md_ && c.maior_despesa && !normalizar(md_[1] ?? "").includes(normalizar(c.maior_despesa.item))) numeros.push(`Maior despesa: esperado "${c.maior_despesa.item}", veio "${md_[1]}"`);

  return { formato, numeros };
}

// Para saídas livres (prompt não estruturado): o resultado correto aparece em algum lugar do texto?
export function resultadoAparece(md, dados) {
  const v = Math.abs(calcular(dados).resultado);
  const inteiro = Math.trunc(v);
  const variantes = [inteiro.toLocaleString("pt-BR"), inteiro.toLocaleString("en-US"), String(inteiro)];
  return variantes.some((x) => md.includes(x));
}

export const palavras = (md) => md.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;

// Similaridade de Jaccard entre os conjuntos de palavras de dois textos (1 = mesmas palavras).
export function jaccard(a, b) {
  const conj = (t) => new Set(normalizar(t).replace(/[^\p{L}\d\s]/gu, " ").split(/\s+/).filter(Boolean));
  const A = conj(a), B = conj(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uniao = A.size + B.size - inter;
  return uniao ? inter / uniao : 1; // dois textos vazios são idênticos
}

// Seção 6 coerente com os dados: registra o que falta, não acusa ausência do que existe, "Nenhuma." só sozinha.
// Só se aplica quando a saída tem a seção 6 (prompts estruturados).
export function observacoesCoerentes(md, dados) {
  const s = secoes(md)["6. Observações sobre os dados"];
  if (!s) return [];
  const erros = [];
  const itens = s.filter((l) => /^\s*-\s/.test(l));
  if (itens.some((l) => /^\s*-\s*Nenhuma\.?\s*$/i.test(l)) && itens.length > 1) erros.push('"Nenhuma." junto com outros itens nas observações');
  for (const [campo, re] of [["periodo_anterior", /anterior/i], ["meta_receita", /meta/i]]) {
    const ausente = dados[campo] == null;
    const fala = itens.some((l) => re.test(l) && /ausen|falt|não (foi|foram|está|há|informad)|N\/D/i.test(l));
    if (ausente && !fala) erros.push(`observações não registram a ausência de ${campo}`);
    if (!ausente && fala) erros.push(`observações afirmam que ${campo} está ausente, mas ele existe`);
  }
  return erros;
}
