# Prisagent — Nordgards Hagen

Automatisk daglig prisovervaking for Nordgards Hagen pa Booking.com.
Systemet kjorer kl. 07:00 hver morgen, sjekker konkurrentpriser, og produserer en rapport med konkrete prisanbefalinger.

---

## Hva systemet gjor

Hver morgen kjores fire agenter etter hverandre:

1. Markedsspeidet - soker Booking.com for Lillehammer-omradet 30 dager fremover og registrerer hvilke konkurrenter som er tilgjengelige
2. Ettersporselsanalytikeren - beregner ettersporselsnivaet, urgency og sesong per dag  
3. Prisoptimalisereren - beregner din optimale pris basert pa 5 faktorer: score, knapphet, ledtid, sesong og trend
4. Strategen - ber Claude skrive en konkret norsk daglig brief med de 3 viktigste prishandlingene

Rapporten lastes opp som en fil du kan laste ned under Actions > siste kjoring > Artifacts.

---

## Oppsett

Se README for komplett steg-for-steg guide. Kort:
1. Legg inn ANTHROPIC_API_KEY som GitHub Secret
2. Oppdater config.js med dine konkurrenter og priser
3. Ga til Actions-fanen og klikk Run workflow

Fra na av kjorer dette automatisk kl. 07:00 hver morgen.

---

*Laget for Nordgards Hagen - Sollivegen 23, 2611 Lillehammer - Booking.com*
