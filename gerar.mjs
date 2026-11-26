// O prompt como função: gerar_relatorio(arquivo de dados) → relatório padronizado.
// Uso: node gerar.mjs inputs/01-padaria-lucro.json [--prompt prompts/estruturado-v1.md] [--saida relatorio.md]
//      node gerar.mjs inputs/01-padaria-lucro.json --so-prompt   (só monta as mensagens, para colar no ChatGPT; não chama a API)
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { RAIZ, chamar } from "./src/llm.mjs";
import { carregarPrompt, montar } from "./src/prompt.mjs";
import { indicadoresFormatados, camposAusentes } from "./src/calculos.mjs";
import { validarEstruturado, observacoesCoerentes } from "./src/validacao.mjs";

const PROMPT_PADRAO = "prompts/estruturado-v4.md";
const arg = (nome) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : undefined; };
const arquivo = process.argv[2];
if (!arquivo || arquivo.startsWith("--")) {
  console.error("Uso: node gerar.mjs <dados.json> [--prompt prompts/estruturado-vN.md] [--saida relatorio.md] [--so-prompt]");
  process.exit(1);
}

const dados = JSON.parse(readFileSync(arquivo, "utf8"));
for (const campo of ["empresa", "setor", "periodo", "moeda", "publico_alvo", "receitas", "despesas"]) {
  if (dados[campo] == null) { console.error(`Campo obrigatório ausente: ${campo}`); process.exit(1); }
}

const prompt = carregarPrompt(path.resolve(RAIZ, arg("--prompt") ?? PROMPT_PADRAO));
const mensagens = montar(prompt, dados, {
  INDICADORES: JSON.stringify(indicadoresFormatados(dados), null, 2),
  CAMPOS_AUSENTES: camposAusentes(dados).map((x) => `- ${x}`).join("\n") || "- (nenhum)",
  CAMPOS_AUSENTES_LINHA: camposAusentes(dados).join(" ") || "nenhum",
});

if (process.argv.includes("--so-prompt")) {
  const texto = `===== INSTRUÇÕES (mensagem de sistema / instruções personalizadas) =====\n\n${mensagens.sistema ?? "(nenhuma)"}\n\n===== MENSAGEM (cole no chat) =====\n\n${mensagens.usuario}\n`;
  const saida = arg("--saida");
  if (saida) writeFileSync(saida, texto); else console.log(texto);
  process.exit(0);
}

// Até 2 tentativas: se a saída não passar na validação, gera de novo (tratamento de erro simples).
let texto, problemas;
for (let tentativa = 1; tentativa <= 2; tentativa++) {
  ({ texto } = await chamar({ ...mensagens, temperatura: 0 }));
  const v = validarEstruturado(texto, dados);
  problemas = [...v.formato, ...v.numeros, ...observacoesCoerentes(texto, dados)];
  if (!problemas.length) break;
}

const saida = arg("--saida");
if (saida) writeFileSync(saida, texto); else console.log(texto);
if (problemas.length) console.error(`\n⚠️ Relatório com problemas de validação (revise antes de enviar):\n- ${problemas.join("\n- ")}`);
