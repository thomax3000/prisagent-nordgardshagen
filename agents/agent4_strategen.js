// ================================================================
// AGENT 4 — STRATEGEN
// Bruker Claude AI til å lese alle data og skrive en
// knallkort, konkret norsk strategibrief for Nordgårds Hagen.
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
  const m = {
    HEV:"📈", SENK:"📉", OK:"✅",
    KNAPPHET_PREMIUM:"🔥", SESONG_PREMIUM:"🏔", SISTE_SJANSE_FYLLING:"⏰"
  };
  return m[s] || "•";
}

function lagDataSammendrag(opt) {
  const topp = opt.toppHandlinger.map(d => ({
    dato:         datoNO(d.dato),
    dagerTil:     d.dagerTilInnsjekk,
    dagensPris:   d.dagensBasispris,
    anbefaltPris: d.anbefaltPris,
    avvik:        d.avvikProsent,
    strategi:     d.strategi,
    knapphet:     `${opt.dager.find(x=>x.dato===d.dato)?.antallTilgjengelige ?? "?"}/${d.totalKonkurrenter} konkurrenter tilgjengelige`,
    urgency:      d.urgencyScore,
  }));

  return {
    eiendom:          CFG.EIENDOM,
    beliggenhet:      CFG.BELIGGENHET,
    dinScore:         CFG.DIN_SCORE,
    markedstemperatur: opt.markedstemperatur,
    oppsummering:     opt.oppsummering,
    toppHandlinger:   topp,
  };
}

async function genererBriefMedClaude(data) {
  const prompt = `Du er en erfaren yield management-rådgiver for ${data.eiendom}, en korttidsutleie i ${data.beliggenhet} (Hafjell/Øyer-området, kjent for skisport og sykling).

Din score er ${data.dinScore}/10 (konkurrentene scorer typisk 9.0+).
Markedstemperatur i dag: ${data.markedstemperatur}

TOPP-HANDLINGER SYSTEMET HAR IDENTIFISERT:
${JSON.stringify(data.toppHandlinger, null, 2)}

STATISTIKK:
- Dager der pris bør heves: ${data.oppsummering.hev}
- Dager der pris er OK: ${data.oppsummering.ok}
- Dager der pris bør senkes: ${data.oppsummering.senk}
- Knapphetspremium-muligheter: ${data.oppsummering.knapphetPremium}
- Sesongpremium-dager: ${data.oppsummering.sesongPremium}

Skriv en KORT daglig strategibrief på norsk. Maks 250 ord. Vær direkte og konkret.
Bruk emojis. Prioriter de viktigste handlingene øverst.
Inkluder KONKRETE kronebeløp og datoer.
Format:
## Markedsstatus [kort setning om markedssituasjonen i dag]
## 🎯 Handle i dag (topp 3 prioritert etter inntektsimpact)
## 💡 Innsikt denne uken (ett viktig mønster du ser i dataene)`;

  const res = await fetch(CFG.ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API feil: ${res.status}`);
  const d = await res.json();
  return (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
}

function lagFallbackRapport(opt) {
  let r = "";
  r += `## Markedsstatus — ${opt.markedstemperatur} etterspørsel\n\n`;
  r += `## 🎯 Handle i dag\n\n`;
  opt.toppHandlinger.slice(0,3).forEach((d, i) => {
    const basispris = d.dagensBasispris ?? 0;
    const anbefalt  = d.anbefaltPris ?? 0;
    const diff    = anbefalt - basispris;
    const retning = diff > 0
      ? `HEV fra ${basispris.toLocaleString("nb-NO")} → ${anbefalt.toLocaleString("nb-NO")} kr (+${d.avvikProsent}%)`
      : `SENK fra ${basispris.toLocaleString("nb-NO")} → ${anbefalt.toLocaleString("nb-NO")} kr (${d.avvikProsent}%)`;
    r += `${i+1}. ${strategiEmoji(d.strategi)} **${datoNO(d.dato)}** — ${retning}\n`;
    r += `   Urgency: ${d.urgencyScore}/100\n\n`;
  });
  r += `## 💡 Innsikt denne uken\n\n`;
  r += `${opt.oppsummering.knapphetPremium} dager med høy knapphet — mulighet for premiumpris.\n`;
  return r;
}

function strategiFarge(s) {
  const m = {
    HEV: "#16a34a", SENK: "#dc2626", OK: "#6b7280",
    KNAPPHET_PREMIUM: "#ea580c", SESONG_PREMIUM: "#7c3aed", SISTE_SJANSE_FYLLING: "#ca8a04"
  };
  return m[s] || "#6b7280";
}

function lagHTMLRapport(opt, briefMD, nu, dagHeader) {
  const strategiRader = opt.dager.map(d => {
    const farge    = strategiFarge(d.strategi);
    const avvikStr = d.avvikProsent > 0 ? `+${d.avvikProsent}%` : `${d.avvikProsent}%`;
    const urgency  = d.urgencyScore >= 70 ? "🔴" : d.urgencyScore >= 40 ? "🟡" : "⚪";
    const helg     = d.erHelg ? " ★" : "";
    const knapph   = d.antallTilgjengelige !== null ? `${d.antallTilgjengelige}/${d.totalKonkurrenter}` : "—";
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;white-space:nowrap;">${datoNO(d.dato)}${helg}</td>
        <td style="padding:8px 12px;text-align:right;">${d.dagensBasispris.toLocaleString("nb-NO")} kr</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;">${d.anbefaltPris.toLocaleString("nb-NO")} kr</td>
        <td style="padding:8px 12px;text-align:right;color:${d.avvikProsent>0?"#16a34a":"#dc2626"};font-weight:600;">${avvikStr}</td>
        <td style="padding:8px 12px;"><span style="background:${farge};color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">${strategiEmoji(d.strategi)} ${d.strategi}</span></td>
        <td style="padding:8px 12px;text-align:center;">${knapph}</td>
        <td style="padding:8px 12px;text-align:center;">${urgency} ${d.urgencyScore}</td>
      </tr>`;
  }).join("");

  const briefHTML = briefMD
    .replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 8px;color:#1e293b;font-size:16px;">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:20px;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px 28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;">🏔 Nordgårds Hagen — Daglig Prisrapport</div>
      <div style="margin-top:6px;opacity:.85;font-size:14px;">${dagHeader} · kl. ${nu.toLocaleTimeString("nb-NO")}</div>
    </div>
    <div style="background:#eff6ff;padding:12px 28px;border-bottom:1px solid #dbeafe;font-size:14px;">
      <strong>Markedstemperatur:</strong> ${opt.markedstemperatur} &nbsp;·&nbsp;
      📈 Hev: ${opt.oppsummering.hev} dager &nbsp;·&nbsp;
      ✅ OK: ${opt.oppsummering.ok} dager &nbsp;·&nbsp;
      pris. Senk: ${opt.oppsummering.senk} dager
    </div>
    <div style="padding:20px 28px;font-size:15px;line-height:1.6;color:#334155;">
      ${briefHTML}
    </div>
    <div style="padding:0 28px 28px;">
      <h2 style="font-size:16px;color:#1e293b;margin-bottom:12px;">📊 30-dagers prisoversikt</h2>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:10px 12px;">Dato</th>
            <th style="padding:10px 12px;text-align:right;">Nå</th>
            <th style="padding:10px 12px;text-align:right;">Anbefalt</th>
            <th style="padding:10px 12px;text-align:right;">Avwkot</th>
            <th style="padding:10px 12px;">Signal</th>
            <th style="padding:10px 12px;text-align:center;">Knapph.</th>
            <th style="padding:10px 12px;text-align:center;">Urgency</th>
          </tr></thead>
          <tbody>${strategiRader}</tbody>
        </table>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Prisagent v2 · ${CFG.EIENDOM} · Score ${CFG.DIN_SCORE}/10 · Oppdater priser i Booking.com extranet
    </div>
  </div>
</body>
</html>`;
}

async function run() {
  console.log("✍️  Agent 4 — Strategen starter...");

  const optPath = path.join(__dirname, "..", "data", "optimalisert.json");
  if (!fs.existsSync(optPath)) throw new Error("optimalisert.json mangler — kjðr Agent 3 først.");

  const opt  = JSON.parse(fs.readFileSync(optPath, "utf8"));
  const data = lagDataSammendrag(opt);

  const nu        = new Date();
  const dagHeader = nu.toLocaleDateString("nb-NO", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  let brief;
  try {
    console.log("   Ber Claude om strategianalyse...");
    brief = await genererBriefMedClaude(data);
    console.log("   ✓ AI-brief generert.");
  } catch (e) {
    console.log(`   ⚨ Claude-kall feilet (${e.message}), bruker fallback-rapport.`);
    brief = lagFallbackRapport(opt);
  }

  let rapport = `# 🏔 Daglig Prisrapport — ${CFG.EIENDOM}\n`;
  rapport += `**${dagHeader}** · Generert kl. ${nu.toLocaleTimeString("nb-NO")}\n\n`;
  rapport += `---\n\n`;
  rapport += brief + "\n\n`";
  rapport += `---\n\n`;

  rapport += `## 📊 30-dagers prisoversikt\n\n`;
  rapport += `| Dato | Nå | Anbefalt | Avvik | Signal | Knapph. | Urgency |\n`;
  rapport += `|------|----|----------|-------|--------|---------|---------|\n`;

  opt.dager.forEach(d => {
    const helg     = d.erHelg ? " ★" : "";
    const avvikStr = d.avvikProsent > 0 ? `+${d.avvikProsent}%` : `${d.avvikProsent}%`;
    const knapphStr = d.antallTilgjengelige !== null ? `${d.antallTilgjengelige}/${d.totalKonkurrenter}` : "—";
    const urgStr    = d.urgencyScore >= 70
      ? `🔴 ${d.urgencyScore}`
      : d.urgencyScore >= 40
        ? `🟡 ${d.urgencyScore}`
        : `⚪ ${d.urgencyScore}`;
    rapport += `| ${datoNO(d.dato)}${helg} | ${d.dagensBasispris.toLocaleString("nb-NO")} | **${d.anbefaltPris.toLocaleString("nb-NO")}** | ${avvikStr} | ${strategiEmoji(d.strategi)} ${d.strategi} | ${knapphStr} | ${urgStr} |\n`;
  });

  rapport += `\n---\n`;
  rapport += `*Rapport generert av Prisagent v2 · ${CFG.EIENDOM} · Score: ${CFG.DIN_SCORE}/10*\n`;
  rapport += `*Oppdater priser manuelt i Booking.com extranet, eller via en kanalstyrer (Smoobu, Beds24)*\n`;

  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "rapport.md"), rapport);

  const html = lagHTMLRapport(opt, brief, nu, dagHeader);
  fs.writeFileSync(path.join(dataDir, "rapport.html"), html);

  console.log("\n" + "═".repeat(65));
  console.log(rapport);
  console.log("═".repeat(65));
  console.log("\n✅ Agent 4 ferdig — rapport lagret til data/rapport.md og data/rapport.html");
}

run().catch(e => { console.error("\n💥 Agent 4 krasjet:", e.message); process.exit(1); });
