// Nordgårds Hagen Prisagent — config.js
// Oppdatert via innstillingspanel

module.exports = {
  EIENDOM:     "Nordgards Hagen",
  BELIGGENHET: "Lillehammer",
  ADRESSE:     "Sollivegen 23, 2611 Lillehammer",
  LAT:         61.1043856,
  LON:         10.5192721,

  // Leiligheter/hele hus: "Hafjell Alpinlandsby", "Sjusjoen Mountain Lodge", "Lillehammer Fjellstue", "Nordseter Apartments"
  // Budsjetthoteller: "Oyer Feriehus"
  KONKURRENTER: ["Hafjell Alpinlandsby", "Sjusjoen Mountain Lodge", "Lillehammer Fjellstue", "Nordseter Apartments", "Oyer Feriehus"],

  MIN_PRIS: 1400,
  MAX_PRIS: 4200,

  BASIS_PRIS: { 0:1900, 1:1600, 2:1600, 3:1700, 4:1900, 5:2500, 6:2700 },

  ANTHROPIC_API_URL: "https://api.anthropic.com/v1/messages",
  BOOKING_MCP_URL:   "https://demandapi-mcp.booking.com/v1/mcp/8132308",
  DAGER_FREMOVER: 30,

  HOYTIDER: [
    "2025-12-24","2025-12-25","2025-12-26","2025-12-27","2025-12-28",
    "2025-12-29","2025-12-30","2025-12-31","2026-01-01",
    "2026-02-14","2026-02-15","2026-02-16","2026-02-17","2026-02-18",
    "2026-02-19","2026-02-20","2026-02-21","2026-02-22",
    "2026-04-02","2026-04-03","2026-04-04","2026-04-05","2026-04-06",
  ],
  SKI_SESONG: [["12-01","04-15"]],
};
