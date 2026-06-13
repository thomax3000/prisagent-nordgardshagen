// ================================================================
// KONFIGURASJON — NORDGÅRDS HAGEN
// Dette er den eneste filen du trenger å redigere.
// ================================================================

module.exports = {
  EIENDOM: "Nordgårds Hagen",
  BELIGGENHET: "Lillehammer",
  // Eksakt adresse: Sollivegen 23, 2611 Lillehammer
  // Koordinater: 61.1043856, 10.5192721
  DIN_SCORE: 8.0,          // Oppdater med din faktiske Booking.com-score
  TOTAL_KONKURRENTER: 5,   // Antall konkurrenter du følger

  // ---- PRISGRENSER ----
  MIN_PRIS: 1400,   // Aldri under dette (absolutt gulv)
  MAX_PRIS: 4200,   // Aldri over dette (absolutt tak)

  // ---- BASISPRISER PER UKEDAG ----
  // Disse brukes når konkurrentdata mangler.
  // 0=Søndag, 1=Mandag ... 6=Lørdag
  BASIS_PRIS: {
    0: 1900,  // Søndag
    1: 1600,  // Mandag
    2: 1600,  // Tirsdag
    3: 1700,  // Onsdag
    4: 1900,  // Torsdag
    5: 2500,  // Fredag
    6: 2700,  // Lørdag
  },

  // ---- KONKURRENTER ----
  // Oppdater med navnene du valgte i dashboardet.
  // Bruk eksakt navn slik det vises på Booking.com.
  KONKURRENTER: [
    "Hafjell Alpinlandsby",
    "Sjusjøen Mountain Lodge",
    "Lillehammer Fjellstue",
    "Nordseter Apartments",
    "Øyer Feriehus",
  ],

  // ---- NORSKE HØYTIDER OG LOKALE EVENTS 2026–2027 ----
  HOYTIDER: [
    "2025-12-20","2025-12-21","2025-12-22","2025-12-23","2025-12-24",
    "2025-12-25","2025-12-26","2025-12-27","2025-12-28","2025-12-29",
    "2025-12-30","2025-12-31",
    "2026-01-01","2026-01-02","2026-01-03","2026-01-04","2026-01-05",
    "2026-02-16","2026-02-17","2026-02-18","2026-02-19","2026-02-20",
    "2026-02-21","2026-02-22","2026-02-23",
    "2026-04-02","2026-04-03","2026-04-04","2026-04-05","2026-04-06",
    "2026-04-07","2026-04-08","2026-04-09","2026-04-10","2026-04-11",
    "2026-04-12","2026-04-13",
    "2026-05-01","2026-05-14","2026-05-15","2026-05-16","2026-05-17",
    "2026-05-18","2026-05-21","2026-05-22","2026-05-23","2026-05-24",
    "2026-05-25","2026-06-01","2026-06-02",
    "2026-05-30","2026-05-31","2026-06-06","2026-06-07",
    "2026-06-13","2026-06-14",
    "2026-06-27","2026-06-28","2026-07-04","2026-07-05",
    "2026-07-11","2026-07-12","2026-07-18","2026-07-19",
    "2026-07-25","2026-07-26","2026-08-01","2026-08-02",
    "2026-12-19","2026-12-20","2026-12-21","2026-12-22","2026-12-23",
    "2026-12-24","2026-12-25","2026-12-26","2026-12-27","2026-12-28",
    "2026-12-29","2026-12-30","2026-12-31",
    "2027-01-01","2027-01-02","2027-01-03","2027-01-04","2027-01-05",
    "2027-02-15","2027-02-16","2027-02-17","2027-02-18","2027-02-19",
    "2027-02-20","2027-02-21","2027-02-22",
  ],

  SKI_SESONG: [
    ["11-15","04-30"],
  ],

  BOOKING_MCP_URL: "https://demandapi-mcp.booking.com/v1/mcp/8132308",
  ANTHROPIC_API_URL: "https://api.anthropic.com/v1/messages",
  DAGER_FREMOVER: 30,
};
