# Turecko Cup 26 – plán vývoje

Plán vychází ze specifikace v3 (kapitoly 1–10; zbytek textu nebyl dodán) a
z auditu referenčních projektů v [`audit-golfgames.md`](audit-golfgames.md).
Kde specifikace mlčí, plán uvádí **předpoklad** označený `[P]` – každý z nich
je rozhodnutí administrátora a dá se změnit konfigurací, ne přepsáním kódu.

**Kritický termín:** první kolo je **8. 10. 2026**, plán vzniká 6. 10. 2026.
Proto je rozdělený na MVP, které musí být nasazené večer 7. 10., a na vrstvy,
které se dají dodat během turnaje, protože se počítají zpětně z raw dat.

---

## 1. Cíl a hranice

Samostatná PWA (nový repozitář `maciii/TureckoCup`, vlastní Firebase projekt,
vlastní hosting). **Golfgames se nemění**, kód se z něj kopíruje a adaptuje;
závislost na něm je jen datová (katalog hřišť `golfgames-courses`).

Mimo rozsah první verze: peněžní vyrovnání, angličtina, ruční zadávání hřišť
(hřiště jsou čtyři a všechna jsou v katalogu), více turnajů v jedné instanci
(model na to je připravený přes `tournaments/{tid}`, UI zná jeden turnaj).

---

## 2. Architektura

### 2.1 Vrstvy (stejné jako Golfgames, jiný zdroj pravdy)

```
screens/        UI, texty přes useT(); nepočítá pravidla
evaluations/    hry turnaje: projekce TournamentRound -> Round(y) Golfgames
                a volání převzatých GameDefinition (skins, stableford, match)
model/          TournamentRound, Player, Team, Position, GameConfig
                + čisté výpočty (holeStarted, netto, projekce flightů a stran)
data/           Firestore: čtení (onSnapshot), zápis (field-path update),
                offline cache, role; localStorage jen jako cache a UI stav
courses/        převzato: types, layout, catalog klient
handicap.ts     převzato: WHS vzorce
```

### 2.2 Datový model (Firestore)

```
tournaments/{tid}
  name, year, teams: { A: {name}, B: {name} }, adminEmails: [..]
  createdAt, updatedAt

tournaments/{tid}/players/{playerId}            // p1..p8, stabilní
  name, nick, handicapIndex, email?, uid?, teamId: 'A'|'B', position: 1..4

tournaments/{tid}/roles/{uid}                   // zapisuje jen admin
  role: 'admin'|'player', playerId?

tournaments/{tid}/rounds/{roundId}              // r1..r5, jeden dokument = jedno kolo
  number, date, status: 'planned'|'live'|'finished'
  course: RoundCourse                           // hluboká kopie z katalogu (pars, SI, tees, CR/SR)
  defaultTeeId, playerTees: { p1: 'white', ... }
  playingHandicaps: { p1: 12, ... }             // spočtené při založení, admin může přepsat
  handicapAllowance: 1.0                        // [P] 100 %; konfigurovatelné
  flights: [[p1,p2,p3,p4],[p5,p6,p7,p8]]
  games: GameConfig[]                           // viz 2.3; lze měnit i po dohrání
  scores:  { p1: { '0': 5, '3': 4 }, ... }      // mapa hráč -> mapa index jamky -> rány
  bonuses: { p1: { '4': ['longest'] }, ... }    // mapa, ne pole polí (Firestore)
  pars?: number[]                               // jen když admin opraví par proti katalogu
  updatedAt, updatedBy
  corrections: [{ at, by, playerId, hole, from, to }]   // audit oprav adminem
```

Zásady:

- **Raw skóre je jediný zdroj**, všechno ostatní (skins, Stableford, pozice,
  týmové body, leaderboard) se počítá na klientu při zobrazení – přesně jako
  v Golfgames. Žádný výsledek se do databáze neukládá, nejde tedy rozejít.
- Zápis jamky je `updateDoc(roundRef, { ['scores.p3.7']: 5, updatedAt })` –
  dva flighty píšou do stejného dokumentu bez konfliktu (rozdíl R8).
- `null`/chybějící klíč = nezapsáno; „vzdaná jamka“ se pozná z toho, že na
  jamce zapsal někdo jiný ze **stejného flightu** (`isHoleStarted` per flight).
- Kolo si nese kopii hřiště (invariant Golfgames #2). Založení kola stáhne
  `course/<id>.json` z katalogu a uloží snímek; pozdější oprava katalogu kolo
  nepřepočítá.

### 2.3 Hry jako konfigurace (`GameConfig`)

Jedno kolo má seznam her; každá hra je `{ id, kind, scope, options }` a
vyhodnocuje se nezávisle nad stejnými `scores`:

| `kind`                  | `scope`                        | Implementace (převzato z Golfgames)                                                                                |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `individual-stableford` | všech 8 (netto)                | `holeStablefordPoints` + `rankRows`                                                                                |
| `individual-skins`      | `flight` nebo `all` [P flight] | projekce flightu na `Round` se 4 hráči → `skinResults()`                                                           |
| `team-skins`            | Team A vs Team B               | projekce na `Round` se 2 „hráči“ = týmy, skóre strany = lepší netto míč týmu (`teamBestBall`), pak `skinResults()` |
| `team-match` [P]        | A vs B, four-ball per flight   | `match.ts` – `matchStateOf()` se stranami dvojic                                                                   |
| `position-duel`         | A{n} vs B{n}, n = 1..4         | konfigurovatelný formát: `strokes-gross`, `strokes-net`, `stableford`, `match-play`; vše nad projekcí 2 hráčů      |

Každý `kind` je modul v `src/evaluations/<kind>.ts` s rozhraním

```ts
interface Evaluation {
  kind: string
  compute(round: TournamentRound, players: Player[], cfg: GameConfig): StandingsSection[]
  holeSummary?(round, players, cfg, hole): HoleSummary[] // průběžný stav u jamky
  teamPoints?(sections): { A: number; B: number } // příspěvek do hlavního týmového skóre
}
```

**Projekce** (`src/model/project.ts`) je klíčový trik znovupoužití: z
`TournamentRound` postaví `Round` v tvaru Golfgames (1–4 hráči, `scores` jako
pole, `course.strokeIndex`, `playingHandicap`, `netScoring`), takže převzaté
`skins.ts`, `stableford.ts`, `match.ts` a `handicap.ts` běží beze změny i se
svými testy. Projekce jsou čisté funkce a testují se samostatně.

### 2.4 Turnajové skóre a soutěž podle pozic

- **Hlavní týmové skóre** = součet `teamPoints()` ze her označených
  `countsForTeam: true` přes všechna kola. [P] Team Skins dává bod za každý
  vyhraný skin; hlavní hra kola (až bude určena) body podle své konfigurace.
- **Soutěž podle pozic** je samostatná sekce leaderboardu, do týmového skóre
  **nevstupuje** (spec §8), dokud admin nepřepne `countsForTeam`.
  Konfiguruje se kdykoli – i po dohrání kola – a počítá se z raw skóre.
- Leaderboard turnaje: Team A : Team B, pořadí jednotlivců (Stableford netto
  součet, skiny), 4 duely pozic s bilancí přes kola.

### 2.5 Role a bezpečnost (`firestore.rules`)

```
Visitor   čte tournaments/** bez přihlášení
Player    přihlášený s roles/{uid}.role == 'player':
          smí měnit jen pole scores.*, bonuses.*, updatedAt, updatedBy
          v kole se status != 'finished'
Admin     e-mail v adminEmails (bootstrap: mac.kubecka@gmail.com)
          nebo roles/{uid}.role == 'admin': smí vše
```

Omezení „hráč smí zapsat jen svůj flight“ se v rules vynucovat nebude [P] –
hraje se v uzavřené skupině 8 lidí, UI zapisovatele vede na jeho flight a
každý zápis nese `updatedBy`; admin má audit a opravu. Rules se testují
emulátorem (`@firebase/rules-unit-testing`) jen na tři případy: anonym nesmí
psát, hráč nesmí měnit `games`/`playingHandicaps`, admin smí.

Přiřazení Google účtu k hráči: admin zadá e-mail u hráče; po prvním přihlášení
se podle `request.auth.token.email` vytvoří `roles/{uid}` (klient to udělá
sám, rules povolí vytvoření jen s rolí `player` a jen když e-mail sedí na
hráče). Hráči s `TBD` e-mailem nemohou zapisovat; zapisuje za ně spoluhráč
nebo admin.

### 2.6 Offline a live

- Firestore `persistentLocalCache` + `onSnapshot` na dokument kola:
  zapisovatel vidí svůj zápis okamžitě, bez signálu se fronta odešle později;
  visitor vidí změnu do sekund.
- Spark kvóty: 8 hráčů × 18 jamek × 5 kol ≈ 720 zápisů za turnaj; čtení
  posluchačů řádově tisíce denně. Hluboko pod 20k/50k.
- Service worker předcachuje aplikaci (Firebase chunk ne, jako v Golfgames).

### 2.7 Obrazovky

| Obrazovka          | Kdo                     | Obsah                                                                                           |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------- |
| Leaderboard (home) | všichni                 | Team A : B, aktuální kolo s live stavem, jednotlivci, duely pozic, menu                         |
| Kolo               | všichni                 | scorekarta obou flightů, výsledky každé hry kola, přepínač hry                                  |
| Zápis skóre        | Player                  | flight hráče, 4 řádky, −/par/+ jako Golfgames, hlavička s průběžným skins                       |
| Hráči a týmy       | všichni / admin edituje | soupiska, HCP, tým, pozice, e-mail                                                              |
| Admin – kolo       | Admin                   | hřiště z katalogu, odpaliště (společné + per hráč), hrací HCP, flighty, hry, par opravy, status |
| Admin – opravy     | Admin                   | scorekarta s možností změnit libovolnou buňku, log oprav                                        |
| Účet               | všichni                 | přihlášení Googlem (převzatý tok), moje role, můj hráč                                          |

Vzhled: tokeny a komponenty Golfgames (tmavé/světlé schéma, značky skóre,
`.screen`/`.content`, scorekarta). Vlastní je jen barva/akcent turnaje a
hlavička s názvem „Turecko Cup 26“.

---

## 3. Fáze a harmonogram

### Fáze 0 – základ projektu (6. 10., ~půl dne)

- [ ] Scaffold: `package.json` (React 19, TS 7, Vite 8, vite-plugin-pwa,
      vitest, prettier, firebase), `tsconfig.json`, `.prettierrc.json`,
      `.nvmrc`, `.editorconfig`, `.gitignore`, `index.html` s boot skriptem
      a `data-theme`, `vite.config.ts` (PWA manifest, Firebase chunk).
- [ ] Překopírovat beze změny: `src/handicap.ts` (+ test), `src/courses/*`
      (+ testy), `src/games/{types,shared,skins,stableford,match,sideBets}.ts`
      (+ testy), `src/i18n/{index.tsx,plural.ts}` + nový `cs.ts`,
      `src/theme.tsx`, `src/pwa.ts`, `src/swipeBack.ts`, `src/sync/{firebase,auth,document}.ts`,
      `src/styles.css` (tokeny + komponenty, vyhodit nepotřebné obrazovky),
      `src/screens/{Scorecard,icons,MenuSheet}.tsx`, `scripts/bump-version.mjs`,
      `scripts/gen-icons.mjs` (nové barvy/značka), `e2e/helpers.ts` + `playwright.config.ts`.
- [ ] `src/types.ts` z Golfgames ponechat jako `src/golfgames/types.ts`
      (model `Round`, na který projekce míří) – minimální úpravy, aby
      převzaté hry a testy prošly `npm run check`.
- [ ] `AGENTS.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `README.md`.
- [ ] GitHub Actions `deploy.yml` (typecheck → test → format → build → Pages).
- [ ] **Firebase (ručně, admin):** projekt na Sparku, Google provider,
      Firestore `eur3` production mode, authorized domain, čtyři
      `VITE_FIREBASE_*` jako repository secrets, Pages source = GitHub Actions,
      doména [P] `turecko.kubecka.cz` (CNAME na `maciii.github.io`).

**Hotovo, když:** `npm run check` zelený, prázdná PWA nasazená na doméně,
přihlášení Googlem funguje na iPhonu.

### Fáze 1 – MVP pro první kolo (6.–7. 10.)

- [ ] `src/model/`: typy `TournamentRound`, `Player`, `GameConfig`;
      `project.ts` (flight → `Round`, týmy → `Round` se 2 stranami, pozice →
      `Round` se 2 hráči); `holeState.ts` (`isHoleStarted` per flight).
      **Testy** projekcí (netto, SI, vzdaná jamka, 8 → 4 hráči).
- [ ] `src/data/`: `tournament.ts` (onSnapshot turnaj/hráči/kola),
      `scores.ts` (`setScore`, `toggleBonus` jako field-path update,
      `updatedBy`), `roles.ts`, `seed.ts` (admin skript / obrazovka: založí
      turnaj, 8 hráčů ze spec §5, 5 kol se snímky hřišť z katalogu).
- [ ] `firestore.rules` + testy v emulátoru.
- [ ] `src/evaluations/`: `individualStableford`, `individualSkins`,
      `teamSkins`; registr; `teamPoints`. **Testy** nad fixturou 8 hráčů.
- [ ] Obrazovky: Leaderboard (live), Kolo (scorekarta 2×4 + výsledky her),
      Zápis skóre (flight), Účet, Hráči (čtení + admin editace HCP/tým/pozice),
      Admin – kolo (hřiště, tee, hrací HCP, flighty, hry, status).
- [ ] Hrací handicap: `playerCourseHandicap(index, layoutTee, 18, par)`
      z převzatého `handicap.ts`; admin vidí tabulku a může přepsat.
- [ ] Playwright smoke v profilu telefonu: zápis 4 skóre se vejde na displej.
- [ ] Nasazení, seed produkčních dat, zkušební kolo nanečisto (2 telefony,
      1 visitor), oprava nálezů.

**Hotovo, když:** 8. 10. ráno jde na Aspendosu zapisovat v obou flightech,
leaderboard bez přihlášení ukazuje Stableford, Individual Skins a Team Skins
živě, admin umí opravit skóre.

### Fáze 2 – během turnaje (8.–10. 10.)

- [ ] `position-duel` evaluace s přepínatelným formátem (brutto, netto,
      Stableford, jamkovka) a zpětným výpočtem pro už odehraná kola.
- [ ] Agregace přes kola: týmové skóre, bilance duelů, součty jednotlivců.
- [ ] Hlavní hra kola (až admin určí formát): `team-match` four-ball přes
      `match.ts`, nebo jiný – jen nový modul v `evaluations/`.
- [ ] Extra body (longest, nearest …) přes převzatý model `BONUSES`, pokud se
      budou hrát; jinak zůstanou vypnuté (hodnota 0).
- [ ] Admin: log oprav, zamknutí kola (`finished`), oprava paru.
- [ ] Drobné UX podle zpětné vazby z hřiště (velikost tlačítek, kontrast na slunci).

### Fáze 3 – volný den a dohrání (11.–13. 10.)

- [ ] Konfigurace Kaya Palazzo pro kola 4 a 5 (stejné hřiště, dvě kola).
- [ ] Export turnaje do JSON (záloha), případně sdílení výsledků odkazem.
- [ ] Dokumentace rozhodnutí (`docs/decisions.md`) a pravidel (`docs/games.md`)
      ve stylu Golfgames.

---

## 4. Rozhodnutí, která potřebuje plán od administrátora

Nebrání zahájení Fáze 0 ani většiny Fáze 1; nejpozději do seedu dat 7. 10.

1. **Odpaliště** pro každé kolo (white vs. yellow/gold) – a zda všichni ze
   stejného, nebo per hráč.
2. **Hlavní hra kola** (formát, bodování do týmového skóre). Do rozhodnutí
   bude týmové skóre tvořit jen Team Skins [P].
3. **Team Skins:** strana = lepší netto míč týmu [P]; přenos banku při dělené
   jamce ano [P]; dvojnásobná 9. a 18. ne [P]; potvrzení parem ne [P].
4. **Individual Skins:** v rámci flightu (4) [P] nebo napříč všemi 8.
5. **Handicap allowance** 100 % [P] a zaokrouhlení hracího HCP na celé rány
   (WHS, převzato).
6. **Soutěž podle pozic:** výchozí formát pro zobrazení (netto rány [P]).
7. **Rozdělení do flightů** per kolo (admin může měnit).
8. **Doména a název** (`turecko.kubecka.cz` [P], „Turecko Cup 26“).
9. **Lykia Links:** CR 74,7 (slope tabulka) nebo 74,0 (scorekarta).
10. Chybějící údaje: HCP Soldík, Jarin, Radek, Honza; e-maily hráčů.
11. **Zavarovak-app:** odkaz na repozitář, pokud má být další referencí.

---

## 5. Struktura repozitáře (cílová)

```
src/
  main.tsx, App.tsx               plochá navigace + History API (převzato)
  golfgames/types.ts              model Round z Golfgames (cíl projekcí)
  handicap.ts                     převzato
  courses/                        převzato
  games/                          převzato: types, shared, skins, stableford, match, sideBets
  model/                          TournamentRound, Player, GameConfig, project.ts, holeState.ts
  evaluations/                    individualStableford, individualSkins, teamSkins, positionDuel, teamMatch, index.ts
  data/                           firebase.ts, auth.ts (převzato), tournament.ts, scores.ts, roles.ts, seed.ts
  i18n/                           index.tsx, plural.ts (převzato), cs.ts (nový katalog)
  screens/                        Leaderboard, RoundScreen, PlayScreen, PlayersScreen, AdminRoundScreen,
                                  CorrectionsScreen, AccountScreen, Scorecard (převzato), MenuSheet (adaptováno)
  styles.css, theme.tsx, pwa.ts, swipeBack.ts   převzato
docs/  audit-golfgames.md, plan.md, architecture.md, games.md, decisions.md, deployment.md
e2e/   responsive.spec.ts (zápis flightu na telefonu)
firestore.rules, firestore.rules.test.ts
scripts/ bump-version.mjs, gen-icons.mjs, seed-tournament.mjs
```

---

## 6. Testovací strategie

- **Vitest (povinné, běží v CI):** převzaté testy her a handicapu beze změny;
  nové testy projekcí (8 → 4, 8 → 2 týmy, 8 → dvojice pozic), evaluací
  (Team Skins přenos a dělená jamka, Stableford netto s SI z Aspendosu,
  duel pozic ve všech čtyřech formátech), agregace přes kola, rules
  v emulátoru.
- **Fixtury s reálnými daty:** snímky čtyř hřišť z katalogu jako JSON ve
  `src/model/fixtures/`, hráči ze spec §5 – testy tak zároveň ověřují
  hrací handicapy, které admin uvidí (např. Mac 12,7 na Aspendos white:
  `round(12.7 × 130/113 + (70.5 − 72)) = 13`).
- **Playwright (lokálně před nasazením):** jen rozvržení na telefonu –
  zápis flightu bez rolování, scorekarta 2×4 roluje uvnitř rámu, leaderboard
  čitelný na 390 px.
- **Nanečisto 7. 10.:** celé kolo na dvou telefonech + jeden anonymní
  prohlížeč, kontrola offline (letadlový režim na 3 jamky).

---

## 7. Rizika a opatření

| Riziko                          | Opatření                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nestihne se MVP do 8. 10.       | Fáze 1 obsahuje jen zápis, Firestore, 3 evaluace a leaderboard; vše ostatní je dopočitatelné z raw dat později. Záložní plán: 1. kolo zapsat na papír a doplnit přes admin opravy. |
| Google popup blokovaný na iOS   | převzatý `preloadAuth()` + redirect fallback; authorized domain nastavit hned ve Fázi 0                                                                                            |
| Souběžný zápis dvou flightů     | field-path update per buňka, jeden dokument na kolo, test v emulátoru                                                                                                              |
| Výpadek signálu na hřišti       | Firestore offline cache, zápis se nikdy neblokuje na síti; UI ukazuje „čeká na odeslání“                                                                                           |
| Chyba v hracím HCP              | admin vidí a může přepsat hodnotu; test s reálnými CR/SR                                                                                                                           |
| Změna formátu her během turnaje | hry jsou konfigurace, raw skóre se nemění; přepočet je okamžitý                                                                                                                    |
| Spec neúplná                    | předpoklady `[P]` v tomto dokumentu, každý jde změnit v adminu                                                                                                                     |
