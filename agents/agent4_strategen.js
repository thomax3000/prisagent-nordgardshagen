// =======================================================================
// AGENT 4 â STRATEGEN
// Bruker Claude AI til Ã¥ lese alle data og skrive en
// knallkort, konkret norsk strategibrief for NordgÃ¥rds Hagen.
// Output: data/rapport.md
// =======================================================================

const fs   = require("fs");
const path = require("path");
const CFG  = require("../config");

const ND = ["sÃ¸n","man","tir","ons","tor","fre","lÃ¸r"];
const NM = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];

function datoNO(str) {
  const d = new Date(str + "T00:00:00");
  return `${ND[d.getDay()]} ${d.getDate()}. ${NM[d.getMonth()]}`;
}

function strategiEmoji(s) {
  const m = {
    HEV:"ð", SENK:"ð", OK:"â",
    KNAPPHET_PREMIUM:"ð¥", SESONG_PREMIUM:"ð", SISTE_SJHANSE_FYLLING:"â°"
  };
  return m[s] || "â¢";
}

function lagDataSammendrag(opt) {
  const topp = opt.toppHandlinger.map(d => ({
    dato:         datoNO(d.dato),
    dagerTil:     d.dagerTilInnsjekk,
    dagensPris:   d.dagensBasispris,
    anbefaltPris: d.anbefaltPris,
    avvik:        d.avvikProsent,
    strategi:     d.strategi,
    knapphet:     `${opt.dager.find(x=>x.strategi===d.strategi)?.antallTilgjengelige ?? "?"}/${d.totalKonkurrenter} konkurrenter tilgjengelige`,
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
  const prompt = `Du er en erfaren yield management-rÃ¥dgiver for ${data.eiendom}, en korttidsutleie i ${data.beliggenhet} (Hajfell/Ãyer-omrÃ¥det, kjent for skisport og sykling).

Din score er ${data.dinScore}/10 (konkurrentene scorer typisk 9.0+).
Markedstemperatur i dag: ${data.markedstemperatur}

TOPP-HANDLINGER SYSTEMET HAR IDENTIFISERT:
${JSON.stringify(data.toppHandlinger, null, 2)}

STATISTIKK:
- Dager der pris bÃ¸r heves: ${data.oppsummering.hev}
- Dager der pris er OK: ${data.oppsummering.ok}
- Dager der pris bÃ¸r senkes: ${data.oppsummering.senk}
- Knapphetspremium-muligheter: ${data.oppsummering.knapphetPremium}
- Sesongpremium-dager: ${data.oppsummering.sesongPremium}

Skriv en KORT daglig strategibrief pÃ¥ norsk. Maks 250 ord. VÃ¦r direkte og konkret.
Bruk emojis. Prioriter de viktigste handlingene Ã¸verst.
Inkluder KONKRETE kronebelÃ¸p og datoer.
Format:
## Markedsstatus [kort setning om markedssituasjonen i dag]
## ð¯ Handle i dag (topp 3 prioritert etter inntektsimpact)
## ð¡ Insykt denne uken (ett viktig mÃ¸nster du ser i dataene)`;

  const res = await fetch(CFG.ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
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
  r += `## Markedsstatus â ${opt.markedstemperatur} etterspÃ¸rsel\n\n`;
  r += `## ð¯ Handle i dag\n\n`;
  opt.toppHandlinger.slice(0,3).forEach((d, i) => {
    const diff    = d.anbefaltPris - d.dagensBasispris;
    const retning = diff > 0
      ? `HEV fra ${d.dagensBasispris.toLocaleString("nb-NO")} â ${d.anbefaltPris.toLocaleString("nb-NO")} kr (+${d.avvikProsent}%)`
      : `SENK fra ${d.dagensBasispris.toLocaleString("nb-NO")} â ${d.anbefaltPris.toLocaleString("nb-NO")} kr (${d.avvikProsent}%)`;
    r += `${i+1}. ${strategiEmoji(d.strategi)} **${datoNO(d.dato)}** â ${retning}\n`;
    r += `   Urgency: ${d.urgencyScore}/100\n\n`;
  });
  r += `## ð¡ Innsykt denne uken\n\n`;
  r += `${opt.oppsummering.knapphetPremium} dager med hÃ¸y knapphet â ulighet for premiumpris.\n`;
  return r;
}

function strategiFarge(s) {
  const m = {
    HEV: "#16a34a", SENK: "#dc2626", OK: "#6b7280",
    KNAPPHET_PREMIUM: "#ea580c", SESONG_PREMIUM: "#7c3aed", SISTE_SHANSE_FYLLING: "#ca8a04"
  };
  return m[s] || "#6b7280";
}

function lagHTMLRapport(opt, briefMD, nÃ¥, dagHeader) {
  const strategiRader = opt.dager.map(d => {
    const farge    = strategiFarge(d.strategi);
    const avvikStr = d.avvikProsent > 0 ? `+${d.avvikProsent}%` : `${d.avvikProsent}%`;
    const urgency  = d.urgencyScore >= 70 ? "ð" : d.urgencyScore >= 40 ? "ð¡" : "â ";
    const helg     = d.erHelg ? " â" : "";
    const knapph   = d.antallTilgjengelige !== null ? `${d.antallTilgjengelige}/${d.totalKonkurrenter}` : "â";
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;white-space:nowrap;">${datoNO(d.dato)}${helg}</td>
        <td style="padding:8px 12px;text-align:right;">${d.dagensBasispris.toLocaleString("nb-NO")} kr</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;">${d.anbefaltPris.toLocaleString("nb-NO")} kr</td>
        <td style="padding:8px 12px;text-align:right;color:${d.avvikProsent>0?"#16a34a":"#dc2626"};font-weight:600;">${avvikStr}</td>
        <td style="padding:8px 12px;"><span style="background:${farge;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">${strategiEmoji(d.strategi)} ${d.strategi}</span></td>
        <td style="padding:8px 12px;text-align:center;">${knapph}</td>
        <td style="padding:8px 12px;text-align:center;">${urgency} ${d.urgencyScore}</td>
      </tr>`;
  }).join("");

  const briefHTML = briefMD
    .replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 8px;color:#1e293b;font-size:16px;">$1</h2>')
    .replace(/\*\(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:20px;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px 28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;">ð NordgÃ¥rds Hagen â Daglig Prisrapport</div>
      <div style="margin-top:6px;opacity:.85;font-size:14px;">${dagHeader} Â· kl. ${nÃ¥.toLocaleTimeString("nb-NO")}</div>
    </div>

    <!-- Temp-bar -->
    <div style="background:#eff6ff;padding:12px 28px;border-bottom:1px solid #dbeafe;font-size:14px;">
      <strong>Markedstemperatur:</strong> ${opt.markedstemperatur} &nbsp;Â·&nbsp;
      ð Hev: ${opt.oppsummering.hev} dager &nbsp;Â·&nbsp;
      â OK: ${opt.oppsummering.ok} dager &nbsp;Â·&nbsp;
      pris. Senk: ${opt.oppsummering.senk} dager
    </div>

    <!-- Brief -->
    <div style="padding:20px 28px;font-size:15px;line-height:1.6;color:#334155;">
      ${briefHTML}
    </div>

    <!-- Pristabell -->
    <div style="padding:0 28px 28px;">
      <h2 style="font-size:16px;color:#1e293b;margin-bottom:12px;">ð 30-dagers prisoversikt</h2>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="padding:10px 12px;">Dato</th>
              <th style="padding:10px 12px;text-align:right;">NÅ¯</th>
              <th style="padding:10px 12px;text-align:right;">Anbefalt</th>
              <th style="padding:10px 12px;text-align:right;">Avwkot</th>
              <th style="padding:10px 12px;">Signal</th>
              <th style="padding:10px 12px;text-align:center;">Knapph.</th>
              <th style="padding:10px 12px;text-align:center;">Urgency</th>
            </tr>
          </thead>
          <tbody>${strategiRader}</tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 28px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Prisagent v2 Â· ${CFG.EIENDOM} Booking.com extranet
    </div>
  </div>
</body>
</html>`;
}

async function run() {
  console.log("â®¹ë\n  Agent 4 â Strategen starter...");

  const optPath = path.join(__dirname, "..", "data", "optimalisert.json");
  if (!fs.existsSync(optPath)) throw new Error("optimalisert.json mangler â kjÃ°r Agent 3 fÃ¸rst.");

  const opt  = JSON.parse(fs.readFileSync(optPath, "utf8"));
  const data = lagDataSammendrag(opt);

  const nÃ¥        = new Date();
  const dagHeader = nÃ¥.toLocaleDateString("nb-NO", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  let brief;
  try {
    console.log("   Ber Claude om strategianalyse...");
    brief = await genererBriefMedClaude(data);
    console.log("   â AI-brief generert.");
  } catch (e) {
    console.log(`    â¢ Claude-kall feilet (${e.message}), bruker fallback-rapport.`);
    brief = lagFallbackRapport(opt);
  }

  // ---- Bygg full rapport ----
  let rapport = `# ð Daglig Prisrapport â ${CFG.EIENDOM}\n`;
  rapport += `**${dagHeader}** Â· Generert kl. ${nÃ¥.toLocaleTimeString("nb-NO")}\n\n`;
  rapport += `---\n\n`;
  rapport += brief + "\n\n";
  rapport += `---\n\n`;

  rapport += `## ð 30-dagers prisoversikt\n\n`;
  rapport += `| Dato | NÃ¥ | Anbefalt | Avvik | Signal | Knapph. | Urgency |\n`;
  rapport += `|------|----|----------|------|--------|---------|---------|\n`;

  opt.dager.forEach(d => {
    const helg     = d.erHelg ? " â" : "";
    const avvikStr = d.avvikProsent > 0 ? `+${d.avvikProsent}%` : `${d.avvikProsent}%`;
    const knapphStr = d.antallTilgjengelige !== null ? `${d.antallTilgjengelige}/${d.totalKonkurrenter}` : "â";
    const urgStr    = d.urgencyScore >= 70
      ? `ð ${d.urgencyScore}`
      : d.urgencyScore >= 40
        ? `ð¡ ${d.urgencyScore}`
        : `â¨ ${d.urgencyScore}`;
    rapport += `| ${datoNO(d.dato)}${helg} | ${d.dagensBasispris.toLocaleString("nb-NO")} | **${d.anbefaltPris.toLocaleString("nb-NO")}** | ${avvikStr} | ${strategiEmoji(d.strategi)} ${d.strategi} | ${knapphStr} | ${urgStr} |\n`;
  });

  rapport += `\n---\n`;
  rapport += `*Rapport generert av Prisagent v2 Â· ${CFG.EIENDOM} Â· Score: ${CFG.DIN_SCORE}/10*\n`;
  rapport += `*Oppdater priser manuelt i Booking.com extranet, eller via en kanalstyrer (Smoobu, Beds24)*\n`;

  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "rapport.md"), rapport);

  // ---- Bygg HTML-rapport for e-post ----
  const html = lagHTMLRapport(opt, brief, nÃ¥, dagHeader);
  fs.writeFileSync(path.join(dataDir, "rapport.html"), html);

  console.log("\n" + "â".repeat(65));
  console.log(rapport);
  console.log("â".repeat(65));
  console.log("\nâ Agent 4 ferdig â rapport lagret til data/rapport.md og data/rapport.html");
}

run().catch(e => { console.error("\nð¥âº Agent 4 krasjet:", e.message); process.exit(1); });
