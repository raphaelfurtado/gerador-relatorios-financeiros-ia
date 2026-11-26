// Suíte de testes do prompt final (saída JSON): N execuções por input, validação contra JSON Schema e métricas
// de consistência (campos presentes, divergência numérica, afirmações sem lastro e variabilidade por campo).
//
// Uso: node run_tests.mjs                                  (prompt final, 3 execuções por input, temperatura 0)
//      node run_tests.mjs --prompt prompts/estruturado-v5.md   (testa outra versão JSON)
//      node run_tests.mjs --execucoes 5                     (mais execuções)
//      node run_tests.mjs --so-relatorio                    (só recalcula as métricas, sem chamar a API)
// Reaproveita execuções já feitas (results/raw-testes.json).
// Sai com código 1 se algum relatório violar o schema, o formato ou os números (pode rodar em CI).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RAIZ, MODELO, chamar, esquemaParaApi } from "./src/llm.mjs";
import { carregarPrompt, montar } from "./src/prompt.mjs";
import { calcular, indicadoresFormatados } from "./src/calculos.mjs";
import { validarEstruturado, observacoesCoerentes, secoes, jaccard } from "./src/validacao.mjs";
import { SCHEMA_MODELO, lerSaidaModelo, montarRelatorio, validarRelatorio, renderizarMarkdown } from "./src/relatorio.mjs";
import { verificarLastro, afirmacoesPorItem } from "./src/lastro.mjs";
import { CASOS } from "./src/casos.mjs";

export const PROMPT_FINAL = "prompts/estruturado-v7.md";

const arg = (nome, padrao) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : padrao; };
const PROMPT = arg("--prompt", PROMPT_FINAL);
const VERSAO = path.basename(PROMPT).match(/v\d+/)?.[0] ?? "vX";
const EXECUCOES = Number(arg("--execucoes", 3));
const TEMPERATURA = Number(arg("--temperatura", 0));
const CONFIG = `${VERSAO}-t${TEMPERATURA}`;
const EH_FINAL = PROMPT === PROMPT_FINAL && TEMPERATURA === 0;

const RAW = path.join(RAIZ, "results", "raw-testes.json");
const INPUTS = readdirSync(path.join(RAIZ, "inputs")).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ id: f.replace(/\.json$/, ""), dados: JSON.parse(readFileSync(path.join(RAIZ, "inputs", f), "utf8")) }));
const raw = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf8")) : {};

// ---------------- Execução ----------------
if (!process.argv.includes("--so-relatorio")) {
  const prompt = carregarPrompt(path.join(RAIZ, PROMPT));
  const esquema = esquemaParaApi(SCHEMA_MODELO);
  for (const inp of INPUTS) {
    const pendentes = [...Array(EXECUCOES).keys()].map((e) => e + 1).filter((e) => !raw[`${CONFIG}|${inp.id}|${e}`]);
    await Promise.all(pendentes.map(async (e) => {
      const msgs = montar(prompt, inp.dados, { INDICADORES: JSON.stringify(indicadoresFormatados(inp.dados), null, 2) });
      const r = await chamar({ ...msgs, temperatura: TEMPERATURA, esquema });
      raw[`${CONFIG}|${inp.id}|${e}`] = { ...r, modelo: MODELO, data: new Date().toISOString() };
      console.log(`${CONFIG} | ${inp.id} | exec ${e} | ${r.ms} ms`);
    }));
    writeFileSync(RAW, JSON.stringify(raw, null, 2));
  }
}

// ---------------- Avaliação ----------------
const sinalCoerente = (rel) => {
  const negativo = rel.indicadores.resultado < 0;
  const r = rel.resumo_executivo;
  return negativo ? /prejuízo/i.test(r) && !/\blucro\b/i.test(r) : !/prejuízo/i.test(r);
};

// Avalia uma configuração JSON (v5 em diante) a partir de results/raw-testes.json.
function avaliarJson(config, gravar) {
  const dir = path.join(RAIZ, "outputs", config);
  if (gravar) mkdirSync(dir, { recursive: true });
  const out = {};
  for (const inp of INPUTS) {
    out[inp.id] = [];
    for (let e = 1; raw[`${config}|${inp.id}|${e}`]; e++) {
      const r = raw[`${config}|${inp.id}|${e}`];
      const saida = lerSaidaModelo(r.texto);
      const rel = saida.obj ? montarRelatorio(inp.dados, saida.obj, { versao: config.split("-")[0] }) : null;
      const md = rel ? renderizarMarkdown(rel) : "";
      if (rel && gravar) {
        writeFileSync(path.join(dir, `${inp.id}-exec${e}.json`), JSON.stringify(rel, null, 2) + "\n");
        writeFileSync(path.join(dir, `${inp.id}-exec${e}.md`), md);
      }
      const v = rel ? validarEstruturado(md, inp.dados) : { formato: ["sem relatório"], numeros: ["sem relatório"] };
      const c = calcular(inp.dados);
      out[inp.id].push({
        rel,
        md,
        schemaModelo: saida.erros,
        schemaRelatorio: rel ? validarRelatorio(rel) : ["sem relatório"],
        formato: v.formato,
        numeros: v.numeros,
        caso: rel ? [...(CASOS[inp.id]?.verificar(md) ?? []), ...observacoesCoerentes(md, inp.dados)] : ["sem relatório"],
        sinal: rel ? sinalCoerente(rel) : false,
        lastro: rel ? verificarLastro(rel, inp.dados) : [],
        afirmacoes: rel ? afirmacoesPorItem(rel, inp.dados) : [],
        divergenciaIndicadores: rel ? Math.max(Math.abs(rel.indicadores.receita_total - c.receita_total), Math.abs(rel.indicadores.despesa_total - c.despesa_total), Math.abs(rel.indicadores.resultado - c.resultado)) : null,
        tokens: r.tokens,
      });
    }
  }
  return out;
}

// Avalia a v4 (Markdown, results/raw.json), convertendo o Markdown nos mesmos campos de texto.
function avaliarV4() {
  const p = path.join(RAIZ, "results", "raw.json");
  if (!existsSync(p)) return null;
  const rawV4 = JSON.parse(readFileSync(p, "utf8"));
  const out = {};
  for (const inp of INPUTS) {
    out[inp.id] = [1, 2, 3].map((e) => rawV4[`v4-t0|${inp.id}|${e}`]).filter(Boolean).map((r) => {
      const s = secoes(r.texto);
      const itens = (nome) => (s[nome] ?? []).filter((l) => /^\s*-\s/.test(l)).map((l) => l.replace(/^\s*-\s*/, "").trim());
      const obs = (rotulo) => {
        const v = itens("6. Observações sobre os dados").find((x) => x.startsWith(rotulo))?.slice(rotulo.length).trim();
        return !v || /^nenhum/i.test(v) ? null : v;
      };
      const rel = {
        indicadores: { resultado: calcular(inp.dados).resultado },
        resumo_executivo: (s["1. Resumo executivo"] ?? []).join(" ").trim(),
        destaques_positivos: itens("3. Destaques positivos"),
        pontos_de_atencao: itens("4. Pontos de atenção"),
        recomendacoes: itens("5. Recomendações"),
        observacoes: { instrucoes_em_dados: obs("Instruções em DADOS:"), valores_atipicos: obs("Valores atípicos:") },
      };
      return { rel, sinal: sinalCoerente(rel), lastro: verificarLastro(rel, inp.dados), afirmacoes: afirmacoesPorItem(rel, inp.dados) };
    });
  }
  return out;
}

const aval = avaliarJson(CONFIG, true);

// ---------------- Métricas ----------------
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const br = (v, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pctTxt = (n, d) => `${n}/${d} (${br(d ? (100 * n) / d : 0, 0)}%)`;
const todosDe = (a) => Object.values(a).flat();
const todos = todosDe(aval);
const N = todos.length;
const conta = (fn) => todos.filter(fn).length;

const CAMPOS = [
  ["empresa", (r) => !!r.empresa],
  ["setor", (r) => !!r.setor],
  ["periodo", (r) => /^\d{2}\/\d{4}$/.test(r.periodo)],
  ["moeda", (r) => !!r.moeda],
  ["publico_alvo", (r) => !!r.publico_alvo],
  ["indicadores (8 valores)", (r) => r.indicadores && Object.keys(r.indicadores).length === 8],
  ["indicadores_formatados (8 valores)", (r) => r.indicadores_formatados && Object.keys(r.indicadores_formatados).length === 8],
  ["resumo_executivo", (r) => r.resumo_executivo?.trim().length > 0],
  ["destaques_positivos (1 a 3)", (r) => r.destaques_positivos?.length >= 1 && r.destaques_positivos.length <= 3],
  ["pontos_de_atencao (1 a 3)", (r) => r.pontos_de_atencao?.length >= 1 && r.pontos_de_atencao.length <= 3],
  ["recomendacoes (1 a 3)", (r) => r.recomendacoes?.length >= 1 && r.recomendacoes.length <= 3],
  ["observacoes.campos_ausentes", (r) => Array.isArray(r.observacoes?.campos_ausentes)],
  ["observacoes.instrucoes_em_dados", (r) => r.observacoes && "instrucoes_em_dados" in r.observacoes],
  ["observacoes.valores_atipicos", (r) => r.observacoes && "valores_atipicos" in r.observacoes],
];
const presenca = CAMPOS.map(([nome, fn]) => [nome, todos.filter((x) => x.rel && fn(x.rel)).length]);
const totalPresentes = presenca.reduce((a, [, n]) => a + n, 0);

const pares = (xs) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b]));
const CAMPOS_VAR = [
  ["indicadores", (r) => JSON.stringify(r.indicadores), "numero"],
  ["observacoes.campos_ausentes", (r) => JSON.stringify(r.observacoes.campos_ausentes), "numero"],
  ["resumo_executivo", (r) => r.resumo_executivo, "texto"],
  ["destaques_positivos", (r) => r.destaques_positivos, "lista"],
  ["pontos_de_atencao", (r) => r.pontos_de_atencao, "lista"],
  ["recomendacoes", (r) => r.recomendacoes, "lista"],
  ["observacoes.instrucoes_em_dados", (r) => r.observacoes.instrucoes_em_dados, "decisao"],
  ["observacoes.valores_atipicos", (r) => r.observacoes.valores_atipicos, "decisao"],
];
function variabilidade(avaliacao, campos = CAMPOS_VAR) {
  return campos.map(([nome, get, tipo]) => {
    const porInput = Object.values(avaliacao).map((lista) => lista.filter((x) => x.rel).map((x) => get(x.rel))).filter((vs) => vs.length > 1);
    const texto = (v) => (Array.isArray(v) ? v.join(" ") : v ?? "");
    const identico = porInput.filter((vs) => new Set(vs.map((v) => JSON.stringify(v))).size === 1).length;
    const sim = media(porInput.map((vs) => media(pares(vs).map(([a, b]) => jaccard(texto(a), texto(b))))));
    const qtdIgual = tipo === "lista" ? porInput.filter((vs) => new Set(vs.map((v) => v.length)).size === 1).length : null;
    const decisaoIgual = tipo === "decisao" ? porInput.filter((vs) => new Set(vs.map((v) => v == null)).size === 1).length : null;
    return { nome, tipo, n: porInput.length, identico, sim, qtdIgual, decisaoIgual };
  });
}
const varAtual = variabilidade(aval);

const lastroTodos = todos.flatMap((x) => x.lastro);
const afirmTodas = todos.flatMap((x) => x.afirmacoes);

const ok = {
  schemaModelo: conta((x) => !x.schemaModelo.length),
  schemaRelatorio: conta((x) => !x.schemaRelatorio.length),
  formato: conta((x) => !x.formato.length),
  numeros: conta((x) => !x.numeros.length),
  caso: conta((x) => !x.caso.length),
  sinal: conta((x) => x.sinal),
  semAfirmacoes: conta((x) => !x.afirmacoes.length),
};
const custo = media(todos.map((x) => (x.tokens.prompt_tokens * 0.15 + x.tokens.completion_tokens * 0.6) / 1e6));

// Comparação: v4 (Markdown) e todas as configurações JSON já executadas, com temperatura 0.
const comparacao = [];
const v4 = avaliarV4();
if (v4) comparacao.push({ nome: "v4", formato: "Markdown escrito pelo modelo", aval: v4 });
const configsJson = [...new Set(Object.keys(raw).map((k) => k.split("|")[0]))].filter((c) => c.endsWith("-t0")).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
for (const c of configsJson) comparacao.push({ nome: c.split("-")[0], formato: "JSON (schema na API) + Markdown gerado por código", aval: c === CONFIG ? aval : avaliarJson(c, false) });

// ---------------- Relatório de testes ----------------
let md = `# Testes de consistência — prompt ${VERSAO} (saída JSON)

Gerado por \`run_tests.mjs\` em ${new Date().toLocaleString("pt-BR")}. Prompt: \`${PROMPT}\` · modelo \`${MODELO}\` · temperatura ${TEMPERATURA} · ${INPUTS.length} inputs × ${EXECUCOES} execuções = ${N} relatórios.
Schemas: [\`schemas/saida-modelo.schema.json\`](../schemas/saida-modelo.schema.json) (o que o modelo devolve) e [\`schemas/relatorio.schema.json\`](../schemas/relatorio.schema.json) (o relatório final).

## 1. Resumo

| Métrica | Resultado |
| --- | --- |
| Resposta do modelo válida no schema \`saida-modelo\` | ${pctTxt(ok.schemaModelo, N)} |
| Relatório final válido no schema \`relatorio\` | ${pctTxt(ok.schemaRelatorio, N)} |
| Campos obrigatórios presentes (${CAMPOS.length} campos × ${N} relatórios) | ${pctTxt(totalPresentes, CAMPOS.length * N)} |
| Markdown gerado no formato padrão (validador da v4) | ${pctTxt(ok.formato, N)} |
| Indicadores corretos (diferença máxima para o cálculo em código) | ${pctTxt(ok.numeros, N)} · diferença máx. ${br(Math.max(...todos.map((x) => x.divergenciaIndicadores ?? 0)))} |
| Números citados nos textos com lastro em DADOS/INDICADORES | ${pctTxt(lastroTodos.filter((l) => l.lastro).length, lastroTodos.length)} |
| Relatórios sem afirmação comparativa sobre item sem dado por item | ${pctTxt(ok.semAfirmacoes, N)} (${afirmTodas.length} afirmações no total) |
| Resumo coerente com o sinal do resultado ("prejuízo" ⇔ resultado < 0) | ${pctTxt(ok.sinal, N)} |
| Verificações específicas dos cenários (injeção, N/D, moeda, etc.) | ${pctTxt(ok.caso, N)} |
| Custo médio por relatório | US$ ${br(custo, 5)} |

## 2. Campos presentes

| Campo | Presente e válido |
| --- | --- |
${presenca.map(([nome, n]) => `| \`${nome}\` | ${pctTxt(n, N)} |`).join("\n")}

## 3. Variabilidade por campo (${EXECUCOES} execuções do mesmo input)

Para cada campo: em quantos dos ${INPUTS.length} inputs as ${EXECUCOES} execuções deram **exatamente** o mesmo valor, a similaridade média do texto entre execuções (Jaccard: 1 = mesmas palavras) e, conforme o tipo, se a quantidade de itens ou a decisão (preenchido × \`null\`) foi a mesma.

| Campo | Origem | Idêntico em todas as execuções | Similaridade média | Mesma quantidade de itens | Mesma decisão (preenchido/null) |
| --- | --- | --- | --- | --- | --- |
${varAtual.map((v) => `| \`${v.nome}\` | ${v.tipo === "numero" ? "código" : "modelo"} | ${v.identico}/${v.n} inputs | ${br(v.sim)} | ${v.qtdIgual == null ? "—" : `${v.qtdIgual}/${v.n}`} | ${v.decisaoIgual == null ? "—" : `${v.decisaoIgual}/${v.n}`} |`).join("\n")}

Os campos numéricos e estruturais vêm do código e são idênticos por construção. A variação restante está na redação dos campos de texto; temperatura 0 não torna a API da OpenAI totalmente determinística.
`;

if (comparacao.length > 1) {
  const cols = comparacao.map((c) => c.nome);
  const linha = (rotulo, fn) => `| ${rotulo} | ${comparacao.map((c) => fn(c)).join(" | ")} |`;
  const tot = (c) => todosDe(c.aval);
  md += `
## 4. Comparação entre versões (temperatura 0, mesmos critérios)

A v4 escrevia o Markdown inteiro; para comparar, o Markdown dela foi convertido nos mesmos campos de texto.

| Métrica | ${cols.join(" | ")} |
| --- | ${cols.map(() => "---").join(" | ")} |
${linha("Formato garantido por", (c) => c.formato)}
${linha("Números citados nos textos com lastro", (c) => { const l = tot(c).flatMap((x) => x.lastro); return pctTxt(l.filter((x) => x.lastro).length, l.length); })}
${linha("Afirmações comparativas sobre item sem dado (total)", (c) => tot(c).flatMap((x) => x.afirmacoes).length)}
${linha("Resumo coerente com o sinal do resultado", (c) => pctTxt(tot(c).filter((x) => x.sinal).length, tot(c).length))}
${CAMPOS_VAR.filter(([, , t]) => t !== "numero").map((campo) => linha(`\`${campo[0]}\`: idêntico nas execuções · similaridade`, (c) => { const v = variabilidade(c.aval, [campo])[0]; return `${v.identico}/${v.n} · ${br(v.sim)}`; })).join("\n")}
`;
}

const secN = comparacao.length > 1 ? 5 : 4;
const listaAfirm = INPUTS.flatMap((inp) => aval[inp.id].flatMap((x, i) => x.afirmacoes.map((a) => `| ${inp.id} | ${i + 1} | \`${a.campo}\` | ${a.frase.replace(/\|/g, "/")} |`)));
const listaLastro = INPUTS.flatMap((inp) => aval[inp.id].flatMap((x, i) => x.lastro.filter((l) => !l.lastro).map((l) => `| ${inp.id} | ${i + 1} | \`${l.campo}\` | ${l.citado} |`)));
md += `
## ${secN}. Divergências nos textos

**Números citados sem lastro** (o modelo calculou ou inventou o valor):

${listaLastro.length ? `| Input | Execução | Campo | Valor citado |\n| --- | --- | --- | --- |\n${listaLastro.join("\n")}` : "Nenhum."}

**Afirmações comparativas sobre um item sem dado por item** (ex.: "a despesa X foi mantida sob controle"; DADOS só traz o mês anterior em totais):

${listaAfirm.length ? `| Input | Execução | Campo | Frase |\n| --- | --- | --- | --- |\n${listaAfirm.join("\n")}` : "Nenhuma."}

## ${secN + 1}. Falhas de validação

`;
const falhas = INPUTS.flatMap((inp) => aval[inp.id].flatMap((x, i) => [
  ...x.schemaModelo.map((f) => ["schema do modelo", f]),
  ...x.schemaRelatorio.map((f) => ["schema do relatório", f]),
  ...x.formato.map((f) => ["formato", f]),
  ...x.numeros.map((f) => ["números", f]),
  ...x.caso.map((f) => ["cenário", f]),
  ...(x.sinal ? [] : [["sinal", "resumo incoerente com o sinal do resultado"]]),
].map(([tipo, f]) => `| ${inp.id} | ${i + 1} | ${tipo} | ${f.replace(/\|/g, "/")} |`)));
md += falhas.length ? `| Input | Execução | Tipo | Falha |\n| --- | --- | --- | --- |\n${falhas.join("\n")}\n` : "Nenhuma falha.\n";

writeFileSync(path.join(RAIZ, "results", `testes-${CONFIG}.md`), md);
writeFileSync(path.join(RAIZ, "results", `testes-${CONFIG}.json`), JSON.stringify({
  config: CONFIG, prompt: PROMPT, modelo: MODELO, temperatura: TEMPERATURA, execucoes: EXECUCOES, relatorios: N,
  conformidade: Object.fromEntries(Object.entries(ok).map(([k, v]) => [k, v / N])),
  campos_presentes: Object.fromEntries(presenca.map(([k, n]) => [k, n / N])),
  numeros_com_lastro: lastroTodos.length ? lastroTodos.filter((l) => l.lastro).length / lastroTodos.length : 1,
  afirmacoes_sem_lastro: afirmTodas.length,
  variabilidade_por_campo: varAtual,
  custo_medio_usd: custo,
}, null, 2) + "\n");

// ---------------- EXEMPLOS.md (prompt final, execução 1 de cada input) ----------------
if (EH_FINAL) {
  let ex = `# 5 exemplos de execução

Gerado por \`run_tests.mjs\`. Prompt final: [\`${PROMPT}\`](${PROMPT}), modelo \`${MODELO}\`, temperatura ${TEMPERATURA}. Execução 1 de cada input; todas as execuções (JSON e Markdown) estão em [\`outputs/${CONFIG}/\`](outputs/${CONFIG}/) e as métricas em [\`results/testes-${CONFIG}.md\`](results/testes-${CONFIG}.md).

Cada exemplo mostra o **input**, o **relatório em JSON** (válido em [\`schemas/relatorio.schema.json\`](schemas/relatorio.schema.json), para integração com outros sistemas) e o **mesmo relatório em Markdown** (gerado por código a partir do JSON, para leitura).

`;
  INPUTS.forEach((inp, i) => {
    const x = aval[inp.id][0];
    const st = (l) => (l.length ? `❌ ${l.join("; ")}` : "✅");
    ex += `## Exemplo ${i + 1} — ${CASOS[inp.id]?.cenario ?? inp.id}

**O que prova:** ${CASOS[inp.id]?.prova}. **Validação:** schema ${st(x.schemaRelatorio)} · formato ${st(x.formato)} · números ${st(x.numeros)} · cenário ${st(x.caso)} · números citados com lastro ${x.lastro.filter((l) => l.lastro).length}/${x.lastro.length}

<details><summary>Input (<code>inputs/${inp.id}.json</code>)</summary>

\`\`\`json
${JSON.stringify(inp.dados, null, 2)}
\`\`\`

</details>

<details><summary>Saída em JSON</summary>

\`\`\`json
${JSON.stringify(x.rel, null, 2)}
\`\`\`

</details>

**Saída em Markdown:**

\`\`\`markdown
${x.md.trim()}
\`\`\`

`;
  });
  writeFileSync(path.join(RAIZ, "EXEMPLOS.md"), ex);
}

console.log(md.split("## 2.")[0]);
const reprovado = ok.schemaRelatorio < N || ok.formato < N || ok.numeros < N;
if (reprovado) { console.error("❌ Reprovado: há relatórios fora do schema, do formato ou com números errados."); process.exit(1); }
console.log(`✅ ${N}/${N} relatórios válidos no schema, no formato e nos números. Detalhes em results/testes-${CONFIG}.md`);
