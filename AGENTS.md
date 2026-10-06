# Pokyny pro AI asistenty

Vstupní bod pro AI asistenty (Claude Code, Copilot, Cursor) a rychlé shrnutí
pro člověka, který projekt vidí poprvé. Čti celý, než začneš měnit kód.

## Co to je

PWA pro golfový turnaj **Turecko Cup 26**: 8 hráčů, 2 týmy po 4, 2 flighty,
5 kol v říjnu 2026. Živý zápis skóre po jamkách, paralelní vyhodnocení více
her ze stejných raw dat (Stableford, Skins, Team Skins, duely pozic), veřejný
leaderboard bez přihlášení, administrace jedním adminem. React 19 +
TypeScript 7 + Vite 8, Firebase (Auth + Firestore na plánu Spark), GitHub
Pages. Jen česky.

Design, infrastruktura a výpočty handicapů jsou převzaté z
[`maciii/golfgames`](https://github.com/maciii/golfgames) – audit a mapa
znovupoužití je v [`docs/audit-golfgames.md`](docs/audit-golfgames.md).

## Kde je co napsané

| Dokument                                           | Co v něm najdeš                                  |
| -------------------------------------------------- | ------------------------------------------------ |
| [`docs/architecture.md`](docs/architecture.md)     | vrstvy, datový model, datová vrstva, rules       |
| [`docs/games.md`](docs/games.md)                   | pravidla her a rozhodnutí tam, kde pravidla mlčí |
| [`docs/decisions.md`](docs/decisions.md)           | proč je to takhle                                |
| [`docs/setup-firebase.md`](docs/setup-firebase.md) | checklist pro admina: Firebase, GitHub, PWA      |
| [`docs/plan.md`](docs/plan.md)                     | plán vývoje a stav                               |
| [`CHANGELOG.md`](CHANGELOG.md)                     | historie změn                                    |

## Pracovní postup

```bash
npm install
npm run dev        # http://localhost:5173/?demo=1 - ukázkový režim bez Firebase
npm run check      # typy + testy + formát; tohle musí projít před commitem
npm run test:e2e   # Playwright, telefonní profil (PW_CHROMIUM=cesta k Chromiu, když chybí)
```

1. Změna kódu.
2. **Testy k výpočtům jsou povinné** (`src/scoring`, `src/evaluations`,
   `src/data/ops`). UI se komponentově netestuje, jen kouřově v Playwrightu.
3. `npm run check` musí projít.
4. Zvedni verzi (`node scripts/bump-version.mjs`, `npm run bump:minor`) a
   zapiš věcnou změnu do `CHANGELOG.md`.
5. Nasazuje se **z `main`** na https://maciii.github.io/TureckoCup/.

## Nepřekročitelná pravidla

1. **Raw skóre je jediný zdroj pravdy.** Skiny, body, duely ani týmové skóre
   se nikam neukládají, počítají se při zobrazení. Hry jsou konfigurace
   (`GameConfig`) a jdou měnit kdykoli, i po dohrání.
2. **Zapsané skóre se nikdy nemaže změnou nastavení.** Smazat ho smí jen
   zapisovatel přidržením čísla nebo admin.
3. **Jeden zápis = jedna buňka** (hráč × jamka). Tak to vyžadují
   `firestore.rules` a tak nejde přepsat cizí zápis z druhého flightu.
4. **Zvednutá jamka je explicitní nula** (`PICKED_UP`), chybějící klíč je
   nezapsáno. Jamka je ve hře rozhodnutá, až když zapsali všichni, kterých se
   týká (flight u Skins, všech osm u Team Skins).
5. **Kolo si nese snímek**: hřiště, HCP indexy, odpaliště, pozice. Změna
   u hráče se promítne do dalších kol, odehraná kola se nepřepočítají.
6. **Žádné pole v poli** v datech - Firestore ho odmítne. Flighty a strany
   jsou seznamy objektů, skóre je mapa map.
7. **Zápisy se neawaitují.** Offline promise nedoběhne; stav dává
   `hasPendingWrites`, odmítnutí rules se zachytí z promise do `meta.error`.
8. **Produkce bez konfigurace Firebase nikdy nespadne na localStorage.**
   Ukázkový režim jen ve vývoji nebo s `?demo=1`.
9. **Nic placeného.** Firebase jen na Sparku, hosting GitHub Pages.
10. **Texty jen v `src/i18n/cs.ts`**, barvy jen přes CSS proměnné, komentáře
    vysvětlují proč.
11. **Firebase se importuje jen dynamicky a jen z `src/data/`.**

## Struktura ve zkratce

```
src/
  model/        typy turnaje (types.ts) a čisté výpočty nad kolem (round.ts)
  scoring/      WHS vzorce (whs.ts), jádro skins a jamkovky - čisté, bez modelu
  evaluations/  hry: stableford, skins, duels; registr index.ts; agregace tournament.ts
  data/         ops.ts (operace + překlad na Firestore), localStore, fireStore, auth, seed
  courses/      snímky čtyř turnajových hřišť z golfgames-courses
  screens/      Overview, Round, Play, Admin, AdminRound, Scorecard, GameResults, MenuSheet
  i18n/         cs.ts (jediný katalog), plural.ts
  nav.ts        hash navigace, theme.tsx, pwa.ts, swipeBack.ts (převzato)
firestore.rules  pravidla zabezpečení (nasazují se ručně z konzole)
e2e/             Playwright kouřový test v ukázkovém režimu
```

## Nejčastější zdroje chyb

- **Rules odmítnou zápis, který mění víc než jednu buňku** nebo který nenese
  `lastEdit` s `by == auth.uid` a `at == request.time`. Každá nová operace
  nad skóre musí jít přes `setScore` v `ops.ts`.
- **Prázdné mapy skóre musí existovat** (`scores.p1 = {}` pro všech 8),
  rules sahají na `resource.data.scores[p]`.
- **Allowance se aplikuje ve hře, ne v kole.** Kolo drží index, odpaliště
  a ruční přepis; hrací HCP počítá `playingHandicap(round, id, allowance)`.
- **Pořadí jamek je per flight** (`flightStartHole`). Přenos banku ve Skins
  jde po pořadí hraní, ne po číslech jamek - evaluace používají `holeOrder()`.
- **Číslo jamky v UI je `hole + 1`**, klíč v mapě je `String(hole)`.
- **`noUncheckedIndexedAccess` je zapnuté** - indexování vrací `T | undefined`.
