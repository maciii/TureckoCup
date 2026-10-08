# Pokyny pro AI asistenty

Vstupní bod pro AI asistenty (Claude Code, Copilot, Cursor) a rychlé shrnutí
pro člověka, který projekt vidí poprvé. Čti celý, než začneš měnit kód.

## Co to je

PWA pro golfový turnaj **Turecko Cup 26**: 8 hráčů, 2 týmy po 4, 2 flighty,
5 kol v říjnu 2026. Živý zápis skóre po jamkách, paralelní vyhodnocení více
her ze stejných raw dat (Stableford, Skins, Team Skins, duely pozic), veřejný
leaderboard bez přihlášení, administrace jedním adminem. React 19 +
TypeScript 7 + Vite 8, Firebase (Auth + Firestore + Hosting na plánu Spark).
Jen česky.

Infrastruktura, výpočty handicapů a ovládání zápisu jsou převzaté z
[`maciii/golfgames`](https://github.com/maciii/golfgames), vizuální design ze
Zavařovák Cupu (`zelisveprem/zavarovak-app`) – audit a mapa znovupoužití je
v [`docs/audit-golfgames.md`](docs/audit-golfgames.md).

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
                   # http://localhost:5173/?demo=4dny - testovací verze po 4 dnech
npm run check      # typy + testy + formát; tohle musí projít před commitem
npm run test:e2e   # Playwright: iPhone 13, iPhone SE, Pixel 7, Galaxy S9+
                   # (bez WebKitu: PW_CHROMIUM=cesta k Chromiu, iOS profily pak v Chromiu)
npm run test:e2e:firebase # Playwright proti emulátorům Auth + Firestore (Java)
npm run test:rules # security rules v emulátoru Firestoru (Java)
npm run test:e2e:live # kouřový test živé aplikace https://turecko-cup.web.app (jen čtení)
```

1. Změna kódu.
2. **Testy k výpočtům jsou povinné** (`src/scoring`, `src/evaluations`,
   `src/data/ops`). UI se komponentově netestuje, ale každá oprava chyby
   v obrazovce dostane scénář v `e2e/` (CI ho pouští na iPhonu ve WebKitu
   i na Androidu).
3. `npm run check` musí projít.
4. Zvedni verzi (`node scripts/bump-version.mjs`, `npm run bump:minor`) a
   zapiš věcnou změnu do `CHANGELOG.md`.
5. Nasazuje se **z `main`** na Firebase Hosting: **https://turecko-cup.web.app**
   (projekt Firebase `turecko-cup`). Tam se aplikace i testuje: po každém
   nasazení CI pustí `npm run test:e2e:live` (jen čtení, nic nezapisuje).
   Ručně testovat proti živé databázi jen s vědomím admina - zápisy jsou ostré.

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
5. **Kolo si nese snímek**: hřiště, HCP indexy, odpaliště, pozice. HCP
   index se zadává u hráče a admin ho zapisuje do všech nedohraných kol
   (`playerIndexOps`), změnu týmu tlačítkem (`rosterSnapshot`); dohraná
   kola se nepřepočítají. **Flighty a pozice jsou nastavení kola** - admin
   je skládá na každý den zvlášť a soupiska je nikdy nepřepisuje.
6. **Žádné pole v poli** v datech - Firestore ho odmítne. Flighty a strany
   jsou seznamy objektů, skóre je mapa map.
7. **Zápisy se neawaitují.** Offline promise nedoběhne; stav dává
   `hasPendingWrites`, odmítnutí rules se zachytí z promise do `meta.error`.
8. **Produkce bez konfigurace Firebase nikdy nespadne na localStorage.**
   Ukázkový režim jen ve vývoji nebo s `?demo=1` (testovací verze `?demo=4dny`).
9. **Nic placeného.** Firebase jen na Sparku (i Hosting), repozitář soukromý.
10. **Texty jen v `src/i18n/cs.ts`**, barvy jen přes CSS proměnné (schéma je
    jen světlé, žádné `#hex` v komponentách), komentáře vysvětlují proč.
11. **Firebase se importuje jen dynamicky a jen z `src/data/`.**
12. **Emulátory a testovací háčky jen za `import.meta.env.DEV`** a
    `VITE_FIREBASE_EMULATOR` (také `VITE_FIREBASE_LONG_POLLING`) - produkční
    build je nesmí obsahovat.

## Struktura ve zkratce

```
src/
  model/        typy turnaje (types.ts), výpočty nad kolem (round.ts), program kola (schedule.ts),
                extra body (bonuses.ts), zvednutá jamka (pickup.ts)
  scoring/      WHS vzorce (whs.ts), jádro skins a jamkovky - čisté, bez modelu
  evaluations/  hry: stableford, skins, duels, bestAggregate, bonuses; registr index.ts; agregace tournament.ts
  data/         ops.ts (operace + překlad na Firestore), localStore, fireStore, auth, seed
  courses/      snímky čtyř turnajových hřišť z golfgames-courses
  screens/      Overview, Round, Play, Admin, AdminRound, Scorecard, GameResults, MenuSheet
  i18n/         cs.ts (jediný katalog), plural.ts
  nav.ts        hash navigace, pwa.ts, swipeBack.ts (převzato)
firestore.rules  pravidla zabezpečení (nasazuje je workflow před aplikací)
firebase.json    Hosting (hlavičky cache), emulátory
e2e/             Playwright v ukázkovém režimu: smoke, play, admin, layout
e2e-firebase/    Playwright proti emulátorům: produkční datová vrstva a rules
e2e-live/        Playwright proti živé aplikaci, jen čtení (visitor, PWA, ukázkový režim)
rules/           testy firestore.rules v emulátoru
```

## Nejčastější zdroje chyb

- **Rules odmítnou zápis, který mění víc než jednu buňku** nebo který nenese
  `lastEdit` s `by == auth.uid` a `at == request.time`. Každá nová operace
  nad skóre musí jít přes `setScore` v `ops.ts`.
- **Firestore odmítne `undefined` a díru v poli.** Seznamy s pevnými místy
  (pozice 1-4) proto drží `''` pro prázdné místo (`assignPosition`). Oba
  adaptery to hlídají přes `findInvalidWrite()` - když ukázkový režim hlásí
  „neplatná hodnota v poli…“, produkce by zápis odmítla taky.
- **Přihlásit se smí jen hráč nebo admin.** Hráč = Google e-mail
  v `private/access.playerEmails` (malými písmeny, jeden e-mail jednomu
  hráči, `setPlayerEmail` v `src/model/access.ts`). Klient podle něj pozná
  jméno hráče a cizí účet odhlásí; rules ho stejně nepustí. Anonymní
  přihlášení v aplikaci není.
- **Pravidla a aplikace se nasazují spolu** (workflow, pravidla první).
  Změna, která v klientovi spoléhá na nová pravidla, bez nich nefunguje.
- **Prázdné mapy skóre musí existovat** (`scores.p1 = {}` pro všech 8),
  rules sahají na `resource.data.scores[p]`.
- **Allowance se aplikuje ve hře, ne v kole.** Kolo drží index, odpaliště
  a ruční přepis; hrací HCP počítá `playingHandicap(round, id, allowance)`.
- **Pořadí jamek je per flight** (`flightStartHole`). Přenos banku ve Skins
  jde po pořadí hraní, ne po číslech jamek - evaluace používají `holeOrder()`.
- **Číslo jamky v UI je `hole + 1`**, klíč v mapě je `String(hole)`.
- **Extra body jsou taky jedna buňka** (`setBonuses` v `ops.ts`, hráč ×
  jamka, seznam id, s logem úprav jako skóre) a nejsou hra: hodnoty a pravidla jsou centrálně
  v `tournament.bonuses` (`bonusConfigOf`), vyhodnocuje je
  `evaluations/bonuses.ts` v každém kole. Centrální pravidlo pro zvednutou
  jamku bere evaluace z `EvaluationContext.pickup` (`tournament.pickup`).
- **Testovací verze (`?demo=4dny`) je jen raw skóre a konfigurace**
  z `src/data/preview.ts` - výsledky počítají stejné evaluace jako ostrý
  turnaj. Nová hra nebo volba hry patří i do některého dne testovací verze,
  ať jde vyzkoušet, než se nastaví naostro.
- **`noUncheckedIndexedAccess` je zapnuté** - indexování vrací `T | undefined`.
