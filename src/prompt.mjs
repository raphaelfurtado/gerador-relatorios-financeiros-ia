// Carrega um template de prompt e injeta os dados.
// Tudo acima do marcador "MENSAGEM DO USUÁRIO" vira mensagem de sistema (fixa);
// o que vem abaixo vira a mensagem do usuário (só dados). Sem marcador = tudo é mensagem do usuário.
import { readFileSync } from "node:fs";

const MARCADOR = /^<!-- =+ MENSAGEM DO USUÁRIO.*-->\s*$/m;

export function carregarPrompt(arquivo) {
  const txt = readFileSync(arquivo, "utf8").replace(/^﻿/, "");
  const partes = txt.split(MARCADOR);
  if (partes.length === 1) return { sistema: null, usuario: partes[0].trim() };
  return { sistema: partes[0].trim(), usuario: partes[1].trim() };
}

export function montar(prompt, dados, extras = {}) {
  let usuario = prompt.usuario.replace("{{DADOS}}", JSON.stringify(dados, null, 2));
  for (const [k, v] of Object.entries(extras)) usuario = usuario.replace(`{{${k}}}`, v);
  return { sistema: prompt.sistema, usuario };
}
