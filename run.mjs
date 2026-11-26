// Micro-capstone M2D1 — roda cada configuração de prompt × 5 inputs × 3 execuções, valida e gera as tabelas.
// Uso: node run.mjs                 (roda o que falta e gera o relatório)
//      node run.mjs --so-relatorio  (só recalcula as tabelas a partir de results/raw.json)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RAIZ, MODELO, chamar } from "./src/llm.mjs";
import { carregarPrompt, montar } from "./src/prompt.mjs";
import { indicadoresFormatados, camposAusentes } from "./src/calculos.mjs";
import { validarEstruturado, observacoesCoerentes, resultadoAparece, estrutura, palavras, jaccard } from "./src/validacao.mjs";
import { CASOS } from "./src/casos.mjs";

export const CONFIGS = [
  { id: "nao-estruturado", prompt: "nao-estruturado.md", temperatura: 1, descricao: "Prompt genérico de uma linha, temperatura 1 (padrão da API)" },
  { id: "v1-t1", prompt: "estruturado-v1.md", temperatura: 1, descricao: "Prompt estruturado v1, temperatura 1 (isola o efeito do prompt)" },
  { id: "v1-t0", prompt: "estruturado-v1.md", temperatura: 0, descricao: "Prompt estruturado v1, temperatura 0 (configuração de produção)" },
  { id: "v2-t1", prompt: "estruturado-v2.md", temperatura: 1, descricao: "Prompt estruturado v2 (indicadores calculados em código), temperatura 1" },
  { id: "v2-t0", prompt: "estruturado-v2.md", temperatura: 0, descricao: "Prompt estruturado v2 (indicadores calculados em código), temperatura 0" },
  { id: "v3-t1", prompt: "estruturado-v3.md", temperatura: 1, descricao: "Prompt estruturado v3 (+ campos ausentes detectados em código), temperatura 1" },
  { id: "v3-t0", prompt: "estruturado-v3.md", temperatura: 0, descricao: "Prompt estruturado v3 (+ campos ausentes detectados em código), temperatura 0" },
  { id: "v4-t1", prompt: "estruturado-v4.md", temperatura: 1, descricao: "Prompt estruturado v4 (+ seção 6 com três campos fixos), temperatura 1" },
  { id: "v4-t0", prompt: "estruturado-v4.md", temperatura: 0, descricao: "Prompt estruturado v4 (+ seção 6 com três campos fixos), temperatura 0 — VERSÃO FINAL" },
];
export const FINAL = "v4-t0";
const EXECUCOES = 3;
const PRECO = [0.15, 0.6]; // US$ por 1M tokens de entrada/saída do gpt-4o-mini

const OUT = path.join(RAIZ, "results");
const RAW = path.join(OUT, "raw.json");
mkdirSync(OUT, { recursive: true });

const INPUTS = readdirSync(path.join(RAIZ, "inputs")).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ id: f.replace(/\.json$/, ""), dados: JSON.parse(readFileSync(path.join(RAIZ, "inputs", f), "utf8")) }));

export const extras = (d) => ({
  INDICADORES: JSON.stringify(indicadoresFormatados(d), null, 2),
  CAMPOS_AUSENTES: camposAusentes(d).map((x) => `- ${x}`).join("\n") || "- (nenhum)", // formato da v3
  CAMPOS_AUSENTES_LINHA: camposAusentes(d).join(" ") || "nenhum", // formato da v4
});

const raw = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf8")) : {};
const chave = (c, i, e) => `${c}|${i}|${e}`;

if (!process.argv.includes("--so-relatorio")) {
  for (const cfg of CONFIGS) {
    const prompt = carregarPrompt(path.join(RAIZ, "prompts", cfg.prompt));
    mkdirSync(path.join(RAIZ, "outputs", cfg.id), { recursive: true });
    for (const inp of INPUTS) {
      const pendentes = [...Array(EXECUCOES).keys()].map((e) => e + 1).filter((e) => !raw[chave(cfg.id, inp.id, e)]);
      await Promise.all(pendentes.map(async (e) => {
        const r = await chamar({ ...montar(prompt, inp.dados, extras(inp.dados)), temperatura: cfg.temperatura });
        raw[chave(cfg.id, inp.id, e)] = { ...r, modelo: MODELO, data: new Date().toISOString() };
        writeFileSync(path.join(RAIZ, "outputs", cfg.id, `${inp.id}-exec${e}.md`), r.texto);
        console.log(`${cfg.id} | ${inp.id} | exec ${e} | ${r.ms} ms`);
      }));
      writeFileSync(RAW, JSON.stringify(raw, null, 2));
    }
  }
}

// ---------------- Avaliação ----------------
const pct = (n, d) => `${n}/${d}`;
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const desvio = (xs) => Math.sqrt(media(xs.map((x) => (x - media(xs)) ** 2)));
const br = (v, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const aval = {}; // aval[cfg][input] = [{...} por execução]
for (const cfg of CONFIGS) {
  aval[cfg.id] = {};
  for (const inp of INPUTS) {
    aval[cfg.id][inp.id] = [];
    for (let e = 1; e <= EXECUCOES; e++) {
      const r = raw[chave(cfg.id, inp.id, e)];
      if (!r) continue;
      const v = validarEstruturado(r.texto, inp.dados);
      aval[cfg.id][inp.id].push({
        texto: r.texto,
        formato: v.formato,
        numeros: v.numeros,
        caso: [...(CASOS[inp.id]?.verificar(r.texto) ?? []), ...observacoesCoerentes(r.texto, inp.dados)],
        resultadoOk: resultadoAparece(r.texto, inp.dados),
        estrutura: estrutura(r.texto),
        palavras: palavras(r.texto),
        tokens: r.tokens,
        ms: r.ms,
      });
    }
  }
}

function resumoCaso(lista) {
  const n = lista.length;
  const pares = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pares.push(jaccard(lista[i].texto, lista[j].texto));
  const ps = lista.map((x) => x.palavras);
  return {
    n,
    formatoOk: lista.filter((x) => !x.formato.length).length,
    numerosOk: lista.filter((x) => !x.numeros.length).length,
    casoOk: lista.filter((x) => !x.caso.length).length,
    resultadoOk: lista.filter((x) => x.resultadoOk).length,
    estruturaIgual: new Set(lista.map((x) => JSON.stringify(x.estrutura))).size === 1,
    palavrasMedia: media(ps),
    cv: (desvio(ps) / media(ps)) * 100,
    jaccard: pares.length ? media(pares) : 1,
  };
}

let md = `# Resultados dos testes\n\nGerado por \`run.mjs\` em ${new Date().toLocaleString("pt-BR")}. Modelo: \`${MODELO}\`. ${INPUTS.length} inputs × ${EXECUCOES} execuções por configuração.\n\n`;
md += `## Configurações\n\n| Configuração | Descrição |\n| --- | --- |\n${CONFIGS.map((c) => `| \`${c.id}\` | ${c.descricao} |`).join("\n")}\n\n`;

md += `## 1. Resumo por configuração\n\n`;
md += `| Configuração | Formato padrão | Números corretos | Verificações do caso | Resultado correto citado | Mesma estrutura nas 3 execuções | Estruturas diferentes (todos os outputs) | Variação de tamanho (CV) | Similaridade entre execuções | Custo médio por relatório |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
for (const cfg of CONFIGS) {
  const todos = Object.values(aval[cfg.id]).flat();
  const casos = Object.values(aval[cfg.id]).map(resumoCaso);
  const N = todos.length;
  const custo = media(todos.map((x) => (x.tokens.prompt_tokens * PRECO[0] + x.tokens.completion_tokens * PRECO[1]) / 1e6));
  const estruturas = new Set(todos.map((x) => JSON.stringify(x.estrutura))).size;
  md += `| \`${cfg.id}\` | ${pct(todos.filter((x) => !x.formato.length).length, N)} | ${pct(todos.filter((x) => !x.numeros.length).length, N)} | ${pct(todos.filter((x) => !x.caso.length).length, N)} | ${pct(todos.filter((x) => x.resultadoOk).length, N)} | ${pct(casos.filter((c) => c.estruturaIgual).length, casos.length)} casos | ${estruturas} | ${br(media(casos.map((c) => c.cv)), 1)}% | ${br(media(casos.map((c) => c.jaccard)))} | US$ ${br(custo, 5)} |\n`;
}
md += `\n- **Formato padrão**: título, 6 seções na ordem, 8 linhas da tabela, 1 a 3 itens nas seções 3 a 5, resumo de até 3 frases, sem cercas de código.\n`;
md += `- **Números corretos**: os 8 indicadores batem com o cálculo feito em código (tolerância de R$ 1 e 0,15 ponto percentual), com o símbolo da moeda certo e "N/D" quando o dado falta.\n`;
md += `- **Verificações do caso**: o que cada input quer provar (ver tabela 2).\n`;
md += `- **Resultado correto citado**: o valor do resultado do mês aparece em algum lugar do texto (vale para qualquer formato, inclusive o não estruturado).\n`;
md += `- **Estruturas diferentes**: quantas sequências distintas de títulos (##, ###) aparecem entre todos os ${INPUTS.length * EXECUCOES} outputs da configuração. 1 = o mesmo esqueleto para todas as empresas e execuções.\n`;
md += `- **CV**: coeficiente de variação do número de palavras entre as 3 execuções do mesmo input (média dos ${INPUTS.length} inputs). Menor = mais estável.\n`;
md += `- **Similaridade**: índice de Jaccard médio entre os vocabulários das 3 execuções do mesmo input (1 = textos com as mesmas palavras).\n\n`;

md += `## 2. Por input\n\n| Input | O que prova | Configuração | Formato | Números | Caso | Mesma estrutura | Palavras (média) | CV | Similaridade |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
for (const inp of INPUTS) {
  for (const cfg of CONFIGS) {
    const r = resumoCaso(aval[cfg.id][inp.id]);
    md += `| ${inp.id} | ${CASOS[inp.id]?.prova ?? ""} | \`${cfg.id}\` | ${pct(r.formatoOk, r.n)} | ${pct(r.numerosOk, r.n)} | ${pct(r.casoOk, r.n)} | ${r.estruturaIgual ? "sim" : "não"} | ${Math.round(r.palavrasMedia)} | ${br(r.cv, 1)}% | ${br(r.jaccard)} |\n`;
  }
}

md += `\n## 3. Falhas encontradas\n\n`;
for (const cfg of CONFIGS) {
  md += `### \`${cfg.id}\`\n\n`;
  const linhas = [];
  for (const inp of INPUTS) aval[cfg.id][inp.id].forEach((x, i) => {
    for (const [tipo, lista] of [["formato", x.formato], ["número", x.numeros], ["caso", x.caso]]) for (const f of lista) linhas.push(`| ${inp.id} | ${i + 1} | ${tipo} | ${f.replace(/\|/g, "/")} |`);
  });
  if (cfg.id === "nao-estruturado") md += `Sem formato definido, nenhuma saída tem as seções e a tabela do padrão. Abaixo, só as verificações de caso.\n\n`;
  const mostrar = cfg.id === "nao-estruturado" ? linhas.filter((l) => l.includes("| caso |")) : linhas;
  md += mostrar.length ? `| Input | Execução | Tipo | Falha |\n| --- | --- | --- | --- |\n${mostrar.join("\n")}\n\n` : `Nenhuma falha.\n\n`;
}

md += `## 4. Estruturas produzidas pelo prompt não estruturado\n\nTítulos de cada saída, para mostrar a variabilidade (o prompt estruturado produz sempre as mesmas 6 seções).\n\n`;
for (const inp of INPUTS) {
  md += `**${inp.id}**\n\n`;
  aval["nao-estruturado"][inp.id].forEach((x, i) => {
    md += `- Execução ${i + 1} (${x.palavras} palavras): ${x.estrutura.length ? x.estrutura.map((t) => t.replace(/^#+\s*/, "").replace(/\*\*/g, "")).join(" → ") : "(sem títulos; texto corrido ou negrito)"}\n`;
  });
  md += `\n`;
}
writeFileSync(path.join(OUT, "tabelas.md"), md);

// Exemplos de execução (configuração final, execução 1 de cada input)
const cfgFinal = CONFIGS.find((c) => c.id === FINAL);
let ex = `# 5 exemplos de execução\n\nGerado por \`run.mjs\`. Prompt: [\`prompts/${cfgFinal.prompt}\`](prompts/${cfgFinal.prompt}), modelo \`${MODELO}\`, temperatura ${cfgFinal.temperatura}. Execução 1 de cada input; as 3 execuções de cada um estão em [\`outputs/${FINAL}/\`](outputs/${FINAL}/).\n\n`;
INPUTS.forEach((inp, i) => {
  const x = aval[FINAL][inp.id][0];
  const ok = (l) => (l.length ? `❌ ${l.join("; ")}` : "✅");
  ex += `## Exemplo ${i + 1} — ${CASOS[inp.id]?.cenario ?? inp.id}\n\n**O que prova:** ${CASOS[inp.id]?.prova}. **Validação:** formato ${ok(x.formato)} · números ${ok(x.numeros)} · caso ${ok(x.caso)}\n\n`;
  ex += `<details><summary>Input (<code>inputs/${inp.id}.json</code>)</summary>\n\n\`\`\`json\n${JSON.stringify(inp.dados, null, 2)}\n\`\`\`\n\n</details>\n\n`;
  ex += `**Output:**\n\n\`\`\`markdown\n${x.texto.trim()}\n\`\`\`\n\n`;
});
writeFileSync(path.join(RAIZ, "EXEMPLOS.md"), ex);
console.log("results/tabelas.md e EXEMPLOS.md gerados.");
