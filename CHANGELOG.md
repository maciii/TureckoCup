# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Patch verzi zvedá `scripts/bump-version.mjs` při každém lokálním buildu.

## [0.1.0] – 2026-10-06

### Přidáno

- Model turnaje: 8 hráčů, 2 týmy, 2 flighty, 5 kol se snímky hřišť
  (Cullinan Aspendos, Lykia Links, Carya, Kaya Palazzo) z katalogu
  golfgames-courses.
- Hry jako konfigurace kola: Stableford, Skins ve flightu, Team Skins, duely
  pozic (brutto, netto, Stableford, jamkovka) a týmový zápas; agregace přes
  kola (týmové skóre, jednotlivci, bilance pozic).
- Živý zápis skóre po jamkách pro flight s explicitním zvednutím jamky.
- Veřejný přehled, kolo s výsledky her a scorekartou obou flightů.
- Admin: inicializace turnaje, hráči (HCP, tým, pozice), nastavení kola
  (stav, odpaliště, hrací HCP s ručním přepisem, flighty, pozice, hry),
  oprávnění, vymazání skóre, záloha JSON.
- Datová vrstva: Firestore s trvalou cache a logem úprav, ukázkový režim
  v localStorage, Google a anonymní přihlášení, security rules.
- PWA s předcachovaným Firebase chunkem, tmavé a světlé schéma.
