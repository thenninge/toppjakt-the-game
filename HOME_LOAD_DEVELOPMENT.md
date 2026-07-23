# Home load development (Laderommet)

**Status:** planlagt — ikke implementert ennå.  
**Entry point i UI:** Hjem → **Laderommet** (placeholder inntil systemet er bygget).

## Hvorfor

Dagens CB Customs home loads er bare «litt strammere fabrikkmatch» (−0,05 MOA vs top Scenar) uten utvikling. Det føles nesten likt på 100 m. Vi vil ha et eget **load development**-loop hjemme: teste, tune, låse en load til rifle×kaliber.

## Rommet

- **Laderommet** er et eget under-rom i Home (ved siden av inatur.no og Shotlog/Dope).
- Ikke blandet med CB Customs-butikken i byen (oppsett/bestilling kan fortsatt starte der, eller flyttes hit senere).
- Krever sannsynligvis `homeLoadsSetup` (eller tilsvarende unlock) før full workflow.

## Retning (utkast)

1. **Utgangspunkt:** kaliber + rifle + komponenter (hylse, primer, krutt, kule) — eller forenklet «base recipe» fra CB.
2. **Testserie:** skyte små serier (evt. koblet til skytebane / chronograf i kit).
3. **Tune-knapper:** f.eks. kruttmengde, seating depth, hals-tension — med risiko for trykk/ufeilbarhet.
4. **Utfall:** bedre `maxAchievableMoa` og/eller lavere `v0Sigma` + ev. bedre affinity-gulv for *den* rifle×load-komboen.
5. **Persistens:** lagret developed load per spiller (ikke bare generisk `ammo-cb-homeload-*`).
6. **Kost:** tid, komponenter, og evt. ødelagte hylser / dump-loads.

## Chronograf (delvis på plass)

- **Garmin Xero i kit** på skytebanen: shotlog får `chronoV0Mps[]` (per skudd) + `chronoTemperatureC` ved målt serie — grunnlag for senere dV/dT.
- **På jakt (Aware):** «Sett opp Chrono» (+5 % nerve), parallelt med camcorder (+20 %).
- Full load-dev i Laderommet bygger videre på disse dataene.

## Åpne spørsmål

- Skal developed loads erstatte katalog-homeloads, eller være egne item-ider?
- Må chronograf være i kit for å «låse» v0, eller er range nok?
- Kobling til CB Customs: bare unlock, eller også kjøp av komponenter?
