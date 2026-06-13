// ================================================================
// AGENT 1 — MARKEDSSPEIDET
// Skanner Booking.com for 30 dager fremover rundt Lillehammer.
// Registrerer ikke bare priser, men også KNAPPHETSINDEKS:
// Hvor mange konkurrenter er fortsatt tilgjengelige?
// Utsolgte konkurrenter = høy etterspørsel = hev din pris.
// Lagrer rådata + oppdaterer historikk for trendanalyse.
// ================================================================

const fs   = require("fs");
const path = require("path");
const CFG  = require("../config");

const pad     = (n) => String(n).padStart(2, "0");
const toISO   = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

async function searchBooking(checkIn, checkOut, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(CFG.ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          system: `You search Booking.com for vacation rentals and return ONLY a valid JSON array.
No markdown, no backticks, no explanation whatsoever.
Format each property exactly as:
{"name":"...","price":1500,"rating":8.5,"reviews":45,"type":"Apartment","available":true}
- available: always true (if it appears in search results, it IS available)
- price: total price for the stay as integer in NOK
- rating: score 0-10 as float, null if unknown
- reviews: integer count, null if unknown
Include ALL properties returned. If zero results, return [].`,
          messages: [{
            role: "user",
            content: `Search apartments and holiday homes in Lillehammer, Norway (including nearby areas like Nordseter, Sjusjøen, Hafjell).
Check-in: ${checkIn}, check-out: ${checkOut}. 2 adults.
Return ALL available properties as JSON array.`,
          }],
          mcp_servers: [{ type: "url", url: CFG.BOOKING_MCP_URL, name: "booking-com" }],
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      try { return JSON.parse(text.trim()); } catch {}
      const m = text.match(/\[[\s\S]*\]/);
      if (m) { try { return JSON.parse(m[0]); } catch {} }
      return [];

    } catch (e) {
      if (attempt < retries) {
        console.log(`  ⚠ Prøver igjen (forsøk ${attempt+2})...`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        throw e;
      }
    }
  }
}

function matchKonkurrent(props, navn) {
  const key = navn.toLowerCase().replace(/[^a-z0-9æøå\s]/g,"").split(" ").filter(w=>w.length>3)[0]
    || navn.substring(0,6).toLowerCase();
  return props.find(p => p.name?.toLowerCase().includes(key));
}

async function run() {
  console.log("🔭 Agent 1 — Markedsspeidet starter");
  console.log(`   Skanner ${CFG.DAGER_FREMOVER} dager fremover i ${CFG.BELIGGENHET}...\n`);

  const today = new Date(); today.setHours(0,0,0,0);
  const kjøring = {
    dato: toISO(today),
    tidspunkt: new Date().toISOString(),
    eiendom: CFG.EIENDOM,
    dager: [],
  };

  for (let i = 0; i < CFG.DAGER_FREMOVER; i++) {
    const d       = addDays(today, i);
    const checkIn = toISO(d);
    const checkOut = toISO(addDays(d, 1));
    process.stdout.write(`  ${checkIn} ... `);

    try {
      const props = await searchBooking(checkIn, checkOut);
      const marked = props.filter(p =>
        p.name && !p.name.toLowerCase().match(/nordg[aå]/i)
      );

      const konkurrentStatus = {};
      let antallTilgjengelige = 0;

      CFG.KONKURRENTER.forEach(navn => {
        const funnet = matchKonkurrent(marked, navn);
        if (funnet) {
          antallTilgjengelige++;
          konkurrentStatus[navn] = { tilgjengelig: true, pris: funnet.price || null, score: funnet.rating || null };
        } else {
          konkurrentStatus[navn] = { tilgjengelig: false, pris: null, score: null };
        }
      });

      const tilgjengeligePriser = Object.values(konkurrentStatus)
        .filter(k => k.tilgjengelig && k.pris > 0)
        .map(k => k.pris);

      const markedsSnitt = tilgjengeligePriser.length > 0
        ? Math.round(tilgjengeligePriser.reduce((a,b)=>a+b,0) / tilgjengeligePriser.length)
        : null;
      const markedsMin  = tilgjengeligePriser.length > 0 ? Math.min(...tilgjengeligePriser) : null;
      const markedsMaks = tilgjengeligePriser.length > 0 ? Math.max(...tilgjengeligePriser) : null;

      const dagData = {
        dato: checkIn,
        ukedag: d.getDay(),
        erHelg: d.getDay() === 5 || d.getDay() === 6,
        antallTilgjengelige,
        totalKonkurrenter: CFG.KONKURRENTER.length,
        knapphetsRatio: parseFloat((1 - antallTilgjengelige / CFG.KONKURRENTER.length).toFixed(2)),
        markedsSnitt,
        markedsMin,
        markedsMaks,
        konkurrenter: konkurrentStatus,
        totaltISokeresultat: marked.length,
      };

      kjøring.dager.push(dagData);
      console.log(`✓ Tilgjengelig: ${antallTilgjengelige}/${CFG.KONKURRENTER.length} | Snitt: ${markedsSnitt ? markedsSnitt.toLocaleString("nb-NO")+" kr" : "—"}`);

    } catch (e) {
      console.log(`✗ Feil: ${e.message}`);
      kjøring.dager.push({
        dato: checkIn, ukedag: d.getDay(), erHelg: d.getDay()===5||d.getDay()===6,
        antallTilgjengelige: null, totalKonkurrenter: CFG.KONKURRENTER.length,
        knapphetsRatio: null, markedsSnitt: null, markedsMin: null, markedsMaks: null,
        konkurrenter: {}, feil: e.message,
      });
    }

    if (i < CFG.DAGER_FREMOVER - 1) await new Promise(r => setTimeout(r, 400));
  }

  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "raw_prices.json"), JSON.stringify(kjøring, null, 2));

  const historikkPath = path.join(dataDir, "historikk.json");
  let historikk = [];
  if (fs.existsSync(historikkPath)) {
    try { historikk = JSON.parse(fs.readFileSync(historikkPath, "utf8")); } catch {}
  }
  const kompakt = {
    dato: kjøring.dato,
    snittMarked: kjøring.dager.map(d => ({ dato: d.dato, snitt: d.markedsSnitt, knapphet: d.knapphetsRatio })),
  };
  historikk = [kompakt, ...historikk].slice(0, 90);
  fs.writeFileSync(historikkPath, JSON.stringify(historikk, null, 2));

  const vellykkede = kjøring.dager.filter(d => d.markedsSnitt !== null).length;
  console.log(`\n✅ Agent 1 ferdig — ${vellykkede}/${CFG.DAGER_FREMOVER} dager hentet.`);
  console.log(`   Historikk: ${historikk.length} dagers data lagret.`);
}

run().catch(e => { console.error("\n💥 Agent 1 krasjet:", e.message); process.exit(1); });
