// ================================================================
// AGENT 4 — STRATEGEN
// Bruker Claude AI til å skrive en norsk strategibrief.
// Output: data/rapport.md
// ================================================================

const fs   = require("fs");
const path = require("path");
const CFG  = require("../config");

const ND = ["søn","man","tir","ons","tor","fre","lør"];
const NM = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];

function datoNO(str) {
  const d = new Date(str + "T00:00:00");
  return `${ND[d.getDay()]} ${d.getDate()}. ${NM[d.getMonth()]}`;
}

function strategiEmoji(s) {
  const m = { HEV:"📈", SENK:"📉", OK:"✅", KNAPPHET_PREMIUM:"🔥", SESONG_PREMIUM:"🏔", SISTE_SJANSE_FYLLING:"⏰" };
  return m[s] || "•";
}

function lagDataSammendrag(opt) {
  const topp = opt.toppHandlinger.map(d => ({
    dato: datoNO(d.dato), dagerTil: d.dagerTilInnsjekk,
    dagensPris: d.dagensBasispris, anbefaltPris: d.anbefaltPris,
    avvik: d.avvikProsent, strategi: d.strategi,
    knapphet: `${opt.dager.find(x=>x.dato===d.dato)?.antallTilgjengelige ?? "?"}/${d.totalKonkurrenter} konkurrenter tilgjengelige`,
    urgency: d.urgencyScore,
  }));
  return {
    eiendom: CFG.EIENDOM, beliggenhet: CFG.BELIGGENHET, dinScore: CFG.DIN_SCORE,
    markedstemperatur: opt.markedstemperatur, oppsummering: opt.oppsummering, toppHandlinger: topp,
  };
}

async function genererBriefMedClaude(data) {
  const prompt = `Du er en erfaren yield management-rådgiver for ${data.eiendom}, korttidsutleie i ${data.beliggenhet}.
Din score er ${data.dinScore}/10. Markedstemperatur: ${data.markedstemperatur}

TOPP-HANDLINGER:
${JSON.stringify(data.toppHandlinger, null, 2)}

STATISTIKK:
- Hev: ${data.oppsummering.hev} dager
- OK: ${data.oppsummering.ok} dager
- Senk: ${data.oppsummering.senk} dager
- Knapphetspremium: ${data.oppsummering.knapphetPremium} dager

Skriv en KORT daglig strategibrief på norsk. Maks 250 ord. Konkret med kronebeløp og datoer.
Format:
## Markedsstatus
## 🎯 Handle i dag (topp 3)
## 💡 Innsikt denne uken`;

  const res = await fetch(CFG.ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude API feil: ${res.status}`);
  const d = await res.json();
  return (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
}

function lagFallbackRapport(opt) {
  let r = `## Markedsstatus — ${opt.markedstemperatur} etterspørsel\n\n## 🎯 Handle i dag\n\n`;
  opt.toppHandlinger.slice(0,3).forEach((d, i) => {
    const diff = d.anbefaltPris - d.dagensBasispris;
    const retning = diff > 0
      ? `HEV fra ${d.dagensBasispris.toLocaleString("nb-NO")} → ${d.anbefaltPris.toLocaleString("nb-NO")} kr (+${d.avvikProsent}%)`
      : `SENK fra ${d.dagensBasispris.toLocaleString("nb-NO")} → ${d.anbefaltPris.toLocaleString("nb-NO")} kr (${d.avvikProsent}%)`;
    r += `${i+1}. ${strategiEmoji(d.strategi)} **${datoNO(d.dato)}** — ${retning}\n   Urgency: ${d.urgencyScore}/100\n\n`;
  });
  r += `## 💡 Innsikt\n\n${opt.oppsummering.knapphetPremium} dager med høy knapphet.\n`;
  return r;
}

async function run() {
  console.log("✍️  Agent 4 — Strategen starter...");

  const optPath = path.join(__dirname, "..", "data", "optimalisert.json");
  if (!fs.existsSync(optPath)) throw new Error("optimalisert.json mangler — kjør Agent 3 først.");

  const opt  = JSON.parse(fs.readFileSync(optPath, "utf8"));
  const data = lagDataSammendrag(opt);
  const nå   = new Date();
  const dagHeader = nå.toLocaleDateString("nb-NO", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  let brief;
  try {
    console.log("   Ber Claude om strategianalyse...");
    brief = await genererBriefMedClaude(data);
    console.log("   ✓ AI-brief generert.");
  } catch (e) {
    console.log(`   ⚠ Claude-kall feilet (${e.message}), bruker fallback.`);
    brief = lagFallbackRapport(opt);
  }

  let rapport = `# 🏔 Daglig Prisrapport — ${CFG.EIENDOM}\n**${dagHeader}** · Generert kl. ${nå.toLocaleTimeString("nb-NO")}\n\n---\n\n${brief}\n\n---\n\n`;
  rapport += `## 📊 30-dagers prisoversikt\n\n| Dato | Nå | Anbefalt | Avvik | Signal | Knapph. | Urgency |\n|------|-----|----------|-------|--------|---------|---------|\n`;

  opt.dager.forEach(d => {
    const helg = d.erHelg ? " ★" : "";
    const avvikStr = d.avvikProsent > 0 ? `+${d.avvikProsent}%` : `${d.avvikProsent}%`;
    const knapphStr = d.antallTilgjengelige !== null ? `${d.antallTilgjengelige}/${d.totalKonkurrenter}` : "—";
    const urgStr = d.urgencyScore >= 70 ? `🔴 ${d.urgencyScore}` : d.urgencyScore >= 40 ? `🟡 ${d.urgencyScore}` : `⚪ ${d.urgencyScore}`;
    rapport += `| ${datoNO(d.dato)}${helg} | ${d.dagensBasispris.toLocaleString("nb-NO")} | **${d.anbefaltPris.toLocaleString("nb-NO")}** | ${avvikStr} | ${strategiEmoji(d.strategi)} ${d.strategi} | ${knapphStr} | ${urgStr} |\n`;
  });

  rapport += `\n---\n*Prisagent v2 · ${CFG.EIENDOM} · Score: ${CFG.DIN_SCORE}/10*\n`;

  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "rapport.md"), rapport);
  console.log("\n✅ Agent 4 ferdig — rapport.md lagret.");
}

run().catch(e => { console.error("\n💥 Agent 4 krasjet:", e.message); process.exit(1); });
