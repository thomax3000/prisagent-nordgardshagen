// ================================================================
// AGENT 2 — ETTERSPØRSELSANALYTIKEREN
// Leser rådata fra Agent 1 og beregner:
//   - Etterspørselssignal per dag (høy/middels/lav)
//   - Pristrend (stiger/synker/stabilt i markedet)
//   - Urgency-score (hvor viktig er det å handle I DAG)
//   - Sesong og høytidsstatus
// ================================================================

const fs   = require("fs");
const path = require("path");
const CFG  = require("../config");

const ND = ["Søn","Man","Tir","Ons","Tor","Fre","Lør"];
const NM = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];

function toNO(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${ND[d.getDay()]} ${d.getDate()}. ${NM[d.getMonth()]}`;
}

function erHøytid(datoStr) {
  return CFG.HOYTIDER.includes(datoStr);
}

function erSkisesong(datoStr) {
  const d = new Date(datoStr + "T00:00:00");
  const mmdd = `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return CFG.SKI_SESONG.some(([start, slutt]) => mmdd >= start || mmdd <= slutt);
}

function beregnPrisTrend(dato, historikk) {
  if (historikk.length < 3) return "STABILT";
  const snittPriser = [];
  for (let i = 0; i < Math.min(5, historikk.length); i++) {
    const h = historikk[i];
    const dag = h.snittMarked?.find(d => d.dato === dato);
    if (dag?.snitt) snittPriser.push(dag.snitt);
  }
  if (snittPriser.length < 2) return "STABILT";
  const nyeste = snittPriser[0];
  const eldste = snittPriser[snittPriser.length - 1];
  const endring = (nyeste - eldste) / eldste;
  if (endring > 0.04) return "STIGER";
  if (endring < -0.04) return "SYNKER";
  return "STABILT";
}

function etterspørselsnivå(knapphetsRatio) {
  if (knapphetsRatio === null) return "UKJENT";
  if (knapphetsRatio >= 0.80) return "EKSTREMT_HØY";
  if (knapphetsRatio >= 0.60) return "HØY";
  if (knapphetsRatio >= 0.40) return "MODERAT_HØY";
  if (knapphetsRatio >= 0.20) return "NORMAL";
  if (knapphetsRatio >= 0)    return "LAV";
  return "UKJENT";
}

function beregnUrgency(dagerTil, etterspørsel, erHelg, høytid) {
  let score = 0;
  if (dagerTil <= 2)  score += 90;
  else if (dagerTil <= 5)  score += 60;
  else if (dagerTil <= 10) score += 30;
  else if (dagerTil <= 20) score += 15;
  else score += 5;
  if (etterspørsel === "EKSTREMT_HØY") score += 40;
  else if (etterspørsel === "HØY") score += 25;
  else if (etterspørsel === "MODERAT_HØY") score += 15;
  else if (etterspørsel === "LAV") score -= 10;
  if (erHelg) score += 15;
  if (høytid) score += 25;
  return Math.min(100, Math.max(0, score));
}

function run() {
  console.log("🧠 Agent 2 — Etterspørselsanalytikeren starter...");

  const rawPath       = path.join(__dirname, "..", "data", "raw_prices.json");
  const historikkPath = path.join(__dirname, "..", "data", "historikk.json");

  if (!fs.existsSync(rawPath)) throw new Error("raw_prices.json mangler — kjør Agent 1 først.");

  const raw       = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const historikk = fs.existsSync(historikkPath)
    ? JSON.parse(fs.readFileSync(historikkPath, "utf8"))
    : [];

  const today = new Date(); today.setHours(0,0,0,0);

  const analyse = {
    analysert: new Date().toISOString(),
    eiendom: CFG.EIENDOM,
    score: CFG.DIN_SCORE,
    antallHistorikkdager: historikk.length,
    markedstemperatur: null,
    dager: [],
  };

  let totalKnapphet = 0, antallMedData = 0;

  raw.dager.forEach(dag => {
    const dagDato      = new Date(dag.dato + "T00:00:00");
    const dagerTil     = Math.round((dagDato - today) / 86400000);
    const høytid       = erHøytid(dag.dato);
    const skisesong    = erSkisesong(dag.dato);
    const trend        = beregnPrisTrend(dag.dato, historikk);
    const etterspørsel = etterspørselsnivå(dag.knapphetsRatio);
    const urgency      = beregnUrgency(dagerTil, etterspørsel, dag.erHelg, høytid);

    if (dag.knapphetsRatio !== null) {
      totalKnapphet += dag.knapphetsRatio;
      antallMedData++;
    }

    analyse.dager.push({
      dato:             dag.dato,
      datoNO:           toNO(dag.dato),
      ukedag:           dag.ukedag,
      erHelg:           dag.erHelg,
      dagerTilInnsjekk: dagerTil,
      høytid,
      skisesong,
      prisTrend:        trend,
      etterspørsel,
      urgencyScore:     urgency,
      antallTilgjengelige: dag.antallTilgjengelige,
      totalKonkurrenter:   dag.totalKonkurrenter,
      knapphetsRatio:      dag.knapphetsRatio,
      markedsSnitt:        dag.markedsSnitt,
      markedsMin:          dag.markedsMin,
      markedsMaks:         dag.markedsMaks,
      konkurrenter:        dag.konkurrenter,
    });
  });

  const snittKnapphet = antallMedData > 0 ? totalKnapphet / antallMedData : 0;
  if (snittKnapphet >= 0.6)      analyse.markedstemperatur = "HØY";
  else if (snittKnapphet >= 0.3) analyse.markedstemperatur = "NORMAL";
  else                            analyse.markedstemperatur = "LAV";

  const dataDir = path.join(__dirname, "..", "data");
  fs.writeFileSync(path.join(dataDir, "analyse.json"), JSON.stringify(analyse, null, 2));

  const høyUrgency      = analyse.dager.filter(d => d.urgencyScore >= 70).length;
  const høyEtterspørsel = analyse.dager.filter(d => ["HØY","EKSTREMT_HØY","MODERAT_HØY"].includes(d.etterspørsel)).length;

  console.log(`\n✅ Agent 2 ferdig.`);
  console.log(`   🌡 Markedstemperatur: ${analyse.markedstemperatur}`);
  console.log(`   🔥 Dager med høy urgency: ${høyUrgency}`);
  console.log(`   📈 Dager med høy etterspørsel: ${høyEtterspørsel}`);
  console.log(`   📊 Historikkdager tilgjengelig: ${historikk.length}`);
}

run();
