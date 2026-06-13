// ================================================================
// AGENT 3 — PRISOPTIMALISEREREN
// OPTIMAL = MARKEDSBASE × KVALITETSFAKTOR × KNAPPHETSMULTIPLIKATOR
//         × LEADTIME_FAKTOR × SESONG_FAKTOR × TREND_FAKTOR
// ================================================================

const fs   = require("fs");
const path = require("path");
const CFG  = require("../config");

function kvalitetsFaktor(dinScore) {
  const markedsScore = 9.0;
  const gap = markedsScore - dinScore;
  return Math.max(0.80, 1 - gap * 0.08);
}

function knapphetsMultiplikator(knapphetsRatio) {
  if (knapphetsRatio === null) return 1.0;
  if (knapphetsRatio >= 1.0)  return 1.50;
  if (knapphetsRatio >= 0.80) return 1.35;
  if (knapphetsRatio >= 0.60) return 1.20;
  if (knapphetsRatio >= 0.40) return 1.08;
  if (knapphetsRatio >= 0.20) return 1.00;
  return 0.93;
}

function leadTimeFaktor(dagerTil) {
  if (dagerTil <= 1)  return 0.72;
  if (dagerTil <= 3)  return 0.82;
  if (dagerTil <= 7)  return 0.91;
  if (dagerTil <= 14) return 1.00;
  if (dagerTil <= 30) return 1.02;
  return 1.00;
}

function sesongFaktor(skisesong, høytid, erHelg) {
  let f = 1.0;
  if (skisesong) f *= 1.15;
  if (høytid)    f *= 1.25;
  if (erHelg && skisesong) f *= 1.10;
  return f;
}

function trendFaktor(trend) {
  if (trend === "STIGER") return 1.05;
  if (trend === "SYNKER") return 0.97;
  return 1.0;
}

function beregnOptimalPris(dag) {
  const ukedag    = dag.ukedag;
  const basisPris = dag.markedsSnitt || CFG.BASIS_PRIS[ukedag] || 1800;

  const kf  = kvalitetsFaktor(CFG.DIN_SCORE);
  const km  = knapphetsMultiplikator(dag.knapphetsRatio);
  const ltf = leadTimeFaktor(dag.dagerTilInnsjekk);
  const sf  = sesongFaktor(dag.skisesong, dag.høytid, dag.erHelg);
  const tf  = trendFaktor(dag.prisTrend);

  const råPris      = basisPris * kf * km * ltf * sf * tf;
  const optimalpris = Math.round(Math.max(CFG.MIN_PRIS, Math.min(CFG.MAX_PRIS, råPris)));

  const dagensBasispris = CFG.BASIS_PRIS[ukedag] || 1800;
  const avvik = Math.round(((optimalpris - dagensBasispris) / dagensBasispris) * 100);

  let strategi;
  if (dag.dagerTilInnsjekk <= 3 && dag.knapphetsRatio < 0.5) strategi = "SISTE_SJANSE_FYLLING";
  else if (dag.knapphetsRatio >= 0.8) strategi = "KNAPPHET_PREMIUM";
  else if (dag.høytid || (dag.skisesong && dag.erHelg)) strategi = "SESONG_PREMIUM";
  else if (avvik > 12) strategi = "HEV";
  else if (avvik < -8) strategi = "SENK";
  else strategi = "OK";

  return {
    ...dag, dagensBasispris, anbefaltPris: optimalpris, avvikProsent: avvik, strategi,
    faktorer: { kf: +kf.toFixed(3), km: +km.toFixed(3), ltf: +ltf.toFixed(3), sf: +sf.toFixed(3), tf: +tf.toFixed(3) },
  };
}

function run() {
  console.log("💡 Agent 3 — Prisoptimalisereren starter...");

  const analysePath = path.join(__dirname, "..", "data", "analyse.json");
  if (!fs.existsSync(analysePath)) throw new Error("analyse.json mangler — kjør Agent 2 først.");

  const analyse = JSON.parse(fs.readFileSync(analysePath, "utf8"));

  const optimalisert = {
    optimalisert: new Date().toISOString(),
    eiendom: CFG.EIENDOM,
    markedstemperatur: analyse.markedstemperatur,
    oppsummering: { hev: 0, ok: 0, senk: 0, knapphetPremium: 0, sesongPremium: 0, sisteSjanse: 0 },
    toppHandlinger: [],
    dager: [],
  };

  const alleDager = analyse.dager.map(beregnOptimalPris);
  optimalisert.dager = alleDager;

  alleDager.forEach(d => {
    if (d.strategi === "HEV" || d.strategi === "KNAPPHET_PREMIUM") optimalisert.oppsummering.hev++;
    else if (d.strategi === "OK") optimalisert.oppsummering.ok++;
    else if (d.strategi === "SENK") optimalisert.oppsummering.senk++;
    if (d.strategi === "KNAPPHET_PREMIUM") optimalisert.oppsummering.knapphetPremium++;
    if (d.strategi === "SESONG_PREMIUM") optimalisert.oppsummering.sesongPremium++;
    if (d.strategi === "SISTE_SJANSE_FYLLING") optimalisert.oppsummering.sisteSjanse++;
  });

  optimalisert.toppHandlinger = alleDager
    .filter(d => d.strategi !== "OK")
    .sort((a, b) => {
      const iA = a.urgencyScore * Math.abs(a.anbefaltPris - a.dagensBasispris);
      const iB = b.urgencyScore * Math.abs(b.anbefaltPris - b.dagensBasispris);
      return iB - iA;
    })
    .slice(0, 7);

  const dataDir = path.join(__dirname, "..", "data");
  fs.writeFileSync(path.join(dataDir, "optimalisert.json"), JSON.stringify(optimalisert, null, 2));

  console.log(`\n✅ Agent 3 ferdig.`);
  console.log(`   📈 Hev/premium:      ${optimalisert.oppsummering.hev} dager`);
  console.log(`   ✅ OK-priser:         ${optimalisert.oppsummering.ok} dager`);
  console.log(`   📉 Senk:             ${optimalisert.oppsummering.senk} dager`);
}

run();
