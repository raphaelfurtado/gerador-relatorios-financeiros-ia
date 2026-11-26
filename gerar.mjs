// O prompt como função: gerar_relatorio(arquivo de dados) → relatório padronizado em JSON e Markdown.
// Uso: node gerar.mjs inputs/01-padaria-lucro.json                      (Markdown na tela)
//      node gerar.mjs inputs/01-padaria-lucro.json --json               (JSON na tela, válido em schemas/relatorio.schema.json)
//      node gerar.mjs inputs/01-padaria-lucro.json --saida relatorio    (grava relatorio.json e relatorio.md)
//      node gerar.mjs inputs/01-padaria-lucro.json --so-prompt          (só monta as mensagens, para colar no ChatGPT; não chama a API)
//      node gerar.mjs inputs/01-padaria-lucro.json --so-prompt --prompt prompts/estruturado-v4.md   (idem, com a v4, que escreve o Markdown inteiro)
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { RAIZ, chamar, esquemaParaApi } from "./src/llm.mjs";
import { carregarPrompt, montar } from "./src/prompt.mjs";
import { indicadoresFormatados, camposAusentes } from "./src/calculos.mjs";
import { SCHEMA_MODELO, lerSaidaModelo, montarRelatorio, validarRelatorio, renderizarMarkdown } from "./src/relatorio.mjs";
import { verificarLastro, afirmacoesPorItem } from "./src/lastro.mjs";

const PROMPT = "prompts/estruturado-v7.md";
const VERSAO = "v7";
const arg = (nome) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : undefined; };
const arquivo = process.argv[2];
if (!arquivo || arquivo.startsWith("--")) {
  console.error("Uso: node gerar.mjs <dados.json> [--json] [--saida <nome sem extensão>] [--so-prompt]");
  process.exit(1);
}

const dados = JSON.parse(readFileSync(arquivo, "utf8"));
for (const campo of ["empresa", "setor", "periodo", "moeda", "publico_alvo", "receitas", "despesas"]) {
  if (dados[campo] == null) { console.error(`Campo obrigatório ausente: ${campo}`); process.exit(1); }
}

const prompt = carregarPrompt(path.resolve(RAIZ, PROMPT));
const mensagens = montar(prompt, dados, { INDICADORES: JSON.stringify(indicadoresFormatados(dados), null, 2) });

if (process.argv.includes("--so-prompt")) {
  // Uso manual (colar no chat): aceita outra versão, ex. --prompt prompts/estruturado-v4.md, que escreve o Markdown inteiro.
  if (arg("--prompt")) {
    const ausentes = camposAusentes(dados);
    Object.assign(mensagens, montar(carregarPrompt(path.resolve(RAIZ, arg("--prompt"))), dados, {
      INDICADORES: JSON.stringify(indicadoresFormatados(dados), null, 2),
      CAMPOS_AUSENTES: ausentes.map((x) => `- ${x}`).join("\n") || "- (nenhum)",
      CAMPOS_AUSENTES_LINHA: ausentes.join(" ") || "nenhum",
    }));
  }
  const texto = `===== INSTRUÇÕES (mensagem de sistema / instruções personalizadas) =====\n\n${mensagens.sistema}\n\n===== MENSAGEM (cole no chat) =====\n\n${mensagens.usuario}\n`;
  const saida = arg("--saida");
  if (saida) writeFileSync(`${saida}.txt`, texto); else console.log(texto);
  process.exit(0);
}

// Até 2 tentativas: se a saída violar o schema ou citar número sem lastro, gera de novo (tratamento de erro simples).
let rel, problemas;
for (let tentativa = 1; tentativa <= 2; tentativa++) {
  const { texto } = await chamar({ ...mensagens, temperatura: 0, esquema: esquemaParaApi(SCHEMA_MODELO) });
  const saida = lerSaidaModelo(texto);
  rel = saida.obj ? montarRelatorio(dados, saida.obj, { versao: VERSAO }) : null;
  problemas = rel
    ? [
        ...validarRelatorio(rel),
        ...verificarLastro(rel, dados).filter((l) => !l.lastro).map((l) => `número sem lastro em ${l.campo}: ${l.citado}`),
        ...afirmacoesPorItem(rel, dados).map((a) => `afirmação sobre item sem dado em ${a.campo}: "${a.frase}"`),
      ]
    : saida.erros;
  if (!problemas.length) break;
}
if (!rel) { console.error(`Falha ao gerar o relatório:\n- ${problemas.join("\n- ")}`); process.exit(1); }

const md = renderizarMarkdown(rel);
const json = JSON.stringify(rel, null, 2) + "\n";
const saida = arg("--saida");
if (saida) {
  writeFileSync(`${saida}.json`, json);
  writeFileSync(`${saida}.md`, md);
  console.log(`Gravados ${saida}.json e ${saida}.md`);
} else {
  console.log(process.argv.includes("--json") ? json : md);
}
if (problemas.length) console.error(`\n⚠️ Relatório com problemas de validação (revise antes de enviar):\n- ${problemas.join("\n- ")}`);
