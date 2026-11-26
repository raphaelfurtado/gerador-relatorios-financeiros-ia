// Chamada à API da OpenAI (Chat Completions) com retentativas.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MODELO = "gpt-4o-mini";

export function env(nome) {
  if (process.env[nome]) return process.env[nome];
  // .env nesta pasta (OPENAI_API_KEY=sk-...) ou, se existir, o .env.local do projeto assistente-rl ao lado
  for (const arq of [path.join(RAIZ, ".env"), path.join(RAIZ, "..", "assistente-rl", ".env.local")]) {
    if (!existsSync(arq)) continue;
    const l = readFileSync(arq, "utf8").split(/\r?\n/).map((x) => x.replace(/^﻿/, "")).find((x) => x.startsWith(`${nome}=`));
    if (l) return l.slice(nome.length + 1).trim();
  }
  return undefined;
}

export async function chamar({ sistema, usuario, temperatura, modelo = MODELO }) {
  const chave = env("OPENAI_API_KEY");
  if (!chave) throw new Error("OPENAI_API_KEY não encontrada. Crie um arquivo .env nesta pasta com OPENAI_API_KEY=sk-...");
  const messages = [...(sistema ? [{ role: "system", content: sistema }] : []), { role: "user", content: usuario }];
  for (let tentativa = 1; ; tentativa++) {
    const t0 = Date.now();
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, messages, temperature: temperatura, max_completion_tokens: 1500 }),
      });
      const j = await r.json();
      if (j.error) throw new Error(`${modelo}: ${j.error.message}`);
      return { texto: j.choices[0].message.content, ms: Date.now() - t0, tokens: j.usage };
    } catch (e) {
      if (tentativa >= 4) throw e;
      await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
    }
  }
}
