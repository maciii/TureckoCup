# Turecko Cup 26

Turnajová golfová aplikace pro 8 hráčů: živý zápis skóre po jamkách, týmové i
individuální vyhodnocení ze stejných raw dat (Stableford, Skins, Team Skins,
duely pozic), veřejný leaderboard bez přihlášení a administrace turnaje.

**Živá verze:** https://maciii.github.io/TureckoCup/
(ukázkový režim bez Firebase: https://maciii.github.io/TureckoCup/?demo=1)

Aplikace je PWA – přidá se na plochu telefonu a běží i bez signálu; zápisy se
odešlou po návratu připojení. Design a výpočty handicapů vycházejí
z [Golfgames](https://github.com/maciii/golfgames), hřiště z
[golfgames-courses](https://github.com/maciii/golfgames-courses).

## Jak to funguje

- **Visitor** vidí přehled turnaje, kola, scorekarty a výsledky bez přihlášení.
- **Zapisovatel** (Google účet na seznamu oprávnění) zapisuje skóre svého
  flightu: klepnutí vloží par, `−`/`+` upraví rány, `×` zvedne jamku,
  přidržení zápis smaže.
- **Administrátor** založí turnaj, spravuje hráče, HCP, týmy, pozice,
  odpaliště, flighty a hry kola, opravuje skóre a spravuje oprávnění.

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5173/?demo=1
npm run check      # typy + testy + formát (totéž co CI)
npm run test:e2e   # Playwright: iPhone (WebKit) a Android (Chromium)
npm run test:e2e:firebase # e2e proti emulátorům Firebase
npm run test:rules # security rules v emulátoru Firestoru
```

Vyžaduje Node 22. Bez konfigurace Firebase běží aplikace v ukázkovém režimu
(data jen v prohlížeči). Produkční nastavení popisuje
[`docs/setup-firebase.md`](docs/setup-firebase.md).

## Dokumentace

| Dokument                                             | Obsah                                     |
| ---------------------------------------------------- | ----------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)       | vrstvy, datový model, datová vrstva, role |
| [`docs/games.md`](docs/games.md)                     | pravidla her a rozhodnutí tam, kde mlčí   |
| [`docs/decisions.md`](docs/decisions.md)             | proč je to takhle                         |
| [`docs/setup-firebase.md`](docs/setup-firebase.md)   | checklist pro administrátora              |
| [`docs/plan.md`](docs/plan.md)                       | plán vývoje a stav                        |
| [`docs/audit-golfgames.md`](docs/audit-golfgames.md) | audit referenčních projektů               |
| [`AGENTS.md`](AGENTS.md)                             | pokyny pro AI asistenty a nové vývojáře   |

## Licence

[MIT](LICENSE)
