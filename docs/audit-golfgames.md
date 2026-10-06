# Audit referenčních projektů (golfgames, golfgames-courses)

Provedeno 6. 10. 2026 nad aktuálním `main` obou repozitářů
(`maciii/golfgames` v0.49.5, `maciii/golfgames-courses`). Spec v3 kapitola 2
vyžaduje audit před implementací; tenhle dokument je jeho výstup a zároveň
mapa toho, co se do Turecko Cupu 26 přebírá, co se adaptuje a kde se záměrně
rozcházíme.

Repozitář **zelisveprem/zavarovak-app** dodal uživatel dodatečně jako zip.
Je to Next.js aplikace pro Zavařovák Cup (Ryder Cup formát, 12 vs 12,
SQLite) - z ní se přebírá **design systém** (viz `decisions.md` #9): světlý
podklad, Inter, pilulky skóre, seznamy s děliči, nadpisy s proužkem,
scorekarta po devítkách, kompaktní hlavička zápisu jamky. Architektura
(server, SQLite, server actions) se nepřebírá - turnaj běží bez vlastního
serveru na Firebase.

---

## 1. Technická platforma Golfgames (ověřeno ze zdrojáků)

| Oblast       | Stav v Golfgames                                                                   | Pro Turecko Cup                         |
| ------------ | ---------------------------------------------------------------------------------- | --------------------------------------- |
| Jazyk/build  | React 19.2, TypeScript 7.0 (`strict`, `noUncheckedIndexedAccess`), Vite 8.2        | převzít 1:1                             |
| Testy        | Vitest 4 (`src/**/*.test.ts`, jen matematika), Playwright 1.62 (jen rozvržení)     | převzít přístup                         |
| PWA          | `vite-plugin-pwa` 1.3, `autoUpdate`, Workbox precache, Firebase chunk vynechaný    | převzít                                 |
| Formát       | Prettier 3 (bez středníků, single quotes, šířka 90), bez ESLintu (TS 7)            | převzít                                 |
| Node         | 22 (`.nvmrc`)                                                                      | převzít                                 |
| Backend      | **žádný**; `localStorage` je zdroj pravdy, Firestore je nepovinné zrcadlo          | **zásadní rozdíl**, viz §4              |
| Auth         | Firebase Auth, Google popup s `select_account`, redirect jako záloha               | převzít mechaniku, změnit roli          |
| Firestore    | `users/{uid}/rounds/{id}`, `users/{uid}/prefs/app`, rules = jen vlastník           | **nový model + role**, viz §4           |
| Functions    | žádné (plán Spark, Blaze zakázán)                                                  | žádné; vše na klientu + rules           |
| Hosting      | GitHub Pages + vlastní doména, workflow `deploy.yml` (typecheck→test→format→build) | převzít, nová doména / podcesta         |
| i18n         | vlastní (`cs.ts` zdroj klíčů, `en.ts` typově kontrolovaný), žádná knihovna         | převzít; stačí **jen čeština** (viz §5) |
| Vzhled       | jediný `styles.css` (3 289 řádků), tmavé/světlé schéma jako CSS proměnné           | převzít tokeny a komponenty, viz §3     |
| Runtime deps | pouze `react`, `react-dom`, `firebase`                                             | stejné                                  |

Závěr: technologie se **shodují s předpoklady specifikace** (kap. 3). Jediná
položka, kterou spec uvádí a Golfgames nemá, jsou Firebase Functions; nejsou
potřeba ani pro Turecko Cup (viz §4).

---

## 2. Co se dá převzít beze změny nebo s minimální adaptací

### 2.1 Handicapy a netto (`src/handicap.ts`, 453 ř., testy 590 ř.)

Čisté funkce bez vazby na UI. Přebírají se:

- `courseHandicap(index, SR, CR, par, holeCount, ratedHoles)` – WHS vzorec
  `index × SR/113 + (CR − par)`, zaokrouhlení na celé rány.
- `playerCourseHandicap()` – obálka nad `HandicapTee` (CR/SR/par/ratedHoles).
- `normalizeStrokeIndex()` a `strokesForHole(playingHcp, SI, holeCount)` –
  rozdělení ran po jamkách podle SI, bez stropu (i 4 rány na jamku).
- `stablefordPoints(netDiff)` – par 2, birdie 3, eagle 4, bogey 1, jinak 0.
- `netScoreAt()`, `netDiffToPar()`, `strokesReceived()`, `pairPlayingHandicap()`.
- `bonusDiffToPar()` – jediné místo, které rozhoduje brutto vs. osobní par pro
  násobení bonusů (volba `multipliersWithHandicap`).
- `parseHandicapIndex()` / `formatHandicapIndex()` – tečka i čárka.

Funkce berou `Round` z Golfgames (max 4 hráči). Pro Turecko Cup se přepíšou
nad nový model (viz plán), vzorce a testy zůstanou.

### 2.2 Hry (`src/games/`)

| Hra v Golfgames                                              | Použití v Turecko Cupu                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `skins.ts` – `skinResults()`                                 | **Individual Skins** (přes flight nebo přes všech 8) i **Team Skins**     |
|                                                              | (strana = tým, rána strany = lepší míč týmu). Přenos banku, dělená jamka, |
|                                                              | potvrzení parem, vzdaná jamka – vše hotové a otestované (418 ř. testů).   |
| `stableford.ts` + `holeStablefordPoints`                     | **Individuální Stableford** netto, 1:1.                                   |
| `match.ts` (jádro jamkovky)                                  | Kandidát pro **soutěž podle pozic** (A1 vs B1 jako jamkovka) a pro        |
|                                                              | případný formát hlavní hry (four-ball). Stav zápasu, dormie, `3&2`.       |
| `shared.ts` – `teamBestBall()`, `CONCEDED`                   | sdílené pomocné výpočty pro lepší míč a vzdanou jamku                     |
| `sideBets.ts`                                                | extra body jako vedlejší sázka – pokud se budou hrát bonusy               |
| `types.ts` – `rankRows()`                                    | řazení se sdílenými pozicemi (1, 1, 3), nehrající na konec                |
| `bestAggregate.ts`, `leftRight.ts`, `dots.ts`, `foursome.ts` | zatím nepotřebné, dostupné                                                |

Rozhraní `GameDefinition` (computeStandings/holeSummary/headerSummary/
scorecard dekorace) je dobře navržené pro **jednu hru nad jedním kolem**.
Turecko Cup potřebuje **víc her paralelně nad stejnými raw daty** (spec §1,
§8), takže rozhraní se přebírá jako vzor, ale zavádí se vrstva „evaluace“ =
seznam `GameDefinition` aplikovaných na jeden `TournamentRound` (viz plán).

### 2.3 Hřiště (`src/courses/`, katalog `golfgames-courses`)

- `courses/types.ts` – model `Course`, `CourseTee`, `isValidCourse()`,
  `normalizeCourse()`; `layout.ts` – `resolveLayout()`, `layoutTee()`.
- `courses/catalog.ts` – klient katalogu (`index.json`, `course/<id>.json`),
  výchozí adresa `https://maciii.github.io/golfgames-courses/`, přepsatelná
  přes `VITE_COURSES_URL`. Žádný dotaz, dokud ho uživatel nevyvolá.
- Kolo si nese **hlubokou kopii** hřiště (`RoundCourse`), takže změna katalogu
  nepřepočítá archiv. **Tohle pravidlo přebíráme beze změny.**

Všechna čtyři turnajová hřiště **v katalogu jsou** s pary, SI, CR i SR
(zdroj: scorekarty a slope tabulky klubů, aktualizováno 9. 8. 2026):

| Kolo | Hřiště (spec)     | `id` v katalogu            | Par | Mužská odpaliště (CR / SR)                                      |
| ---: | ----------------- | -------------------------- | --: | --------------------------------------------------------------- |
|    1 | Cullinan Aspendos | `aspendos`                 |  72 | White 70,5/130 · Yellow 68,1/118                                |
|    2 | Lykia Links       | `lykia-links`              |  73 | Black 78,0/140 · White 74,7/133 · Gold 71,7/126 · Blue 65,7/115 |
|    3 | Carya             | `belek-carya`              |  72 | Black 74,9/145 · White 72,3/136 · Yellow 70,4/130               |
|  4,5 | Kaya Palazzo      | `kaya-palazzo-golf-course` |  72 | White 71,0/127 · Yellow 69,4/121                                |

Poznámky k ověření:

- Lykia Links je **par 73** a scorekarta klubu uvádí bílé CR 74,0, slope
  tabulka 74,7 – katalog drží 74,7. Před turnajem rozhodnout, co platí.
- Katalog u Lykie označuje `blue` jako pánské přední odpaliště; `red` je dámské.
- U Carye a Kaya Palazzo jsou `blue` a `red` dámské normy.
- Volba odpaliště pro turnaj (white vs. yellow/gold) není ve specifikaci –
  musí ji nastavit administrátor per kolo (spec §10 to předpokládá).

### 2.4 Firebase a autentizace (`src/sync/`)

- `firebase.ts` – líné načtení SDK dynamickým importem, kontrola konfigurace
  z `VITE_FIREBASE_*`, `browserLocalPersistence`. Převzít.
- `auth.ts` – `preloadAuth()` + synchronní `signInWithPopup` (bez `await`
  před ním, jinak Safari popup zablokuje), `select_account`, redirect fallback.
  **Převzít doslova** – je to nejkřehčí část a je vyladěná na iOS.
- `document.ts` – `forFirestore()` (odstraní `undefined`), kódování pole polí
  (`bonuses[hráč][jamka]`) do mapy, protože Firestore nested arrays neumí.
  Převzít; stejný problém budeme mít u `scores[hráč][jamka]` pro 8 hráčů.
- `sync.ts`, `merge.ts` – odložený push (10 s), fronta ve `localStorage`,
  tombstony, „vyhrává novější `updatedAt`“. **Nepřebírá se celé** – model je
  jiný (viz §4), ale vzor fronty a offline-first zápisu ano.
- Nastavení Firebase projektu krok za krokem je v `docs/sync.md` (Spark,
  Google provider, authorized domains, eur3, production mode, rules). Platí
  i pro nový projekt.

### 2.5 Vzhled a UX (`src/styles.css`, obrazovky)

Tokeny, které přebíráme beze změny (rozhodnutí #38):

```
--bg #0f1c14  --bg-elevated #17281d  --bg-input #1e3326  --line #2a4433
--text #eef4ef  --text-dim #9fb4a6  --accent #4ade80  --under/--info #7dd3fc
--over #fca5a5  --tap 48px
značky skóre: eagle #f2c14e, birdie #e8402a, par #3b9ce8, bogey #5bb85b,
              double #8a8a8a, triple #1c1c1c (stejné v obou schématech)
světlé schéma: --bg #eef2ea, --accent #15803d, text #14241a
```

Vzory, které přebíráme:

- `.screen` vysoká `100dvh`, roluje se jen `.content` (rozhodnutí #32) –
  patička a hlavička se na iOS neodlepí.
- Zápis skóre: par doprostřed, `−`/`+` kolem, žádná klávesnice, přidržení =
  smazání (rozhodnutí #13); vše musí sedět na jednu obrazovku (pravidlo 10).
- Scorekarta se značkami (kroužky pod par, čtverce nad par), sloupce OUT/IN,
  tečky HCP u výsledku, vodorovné rolování uvnitř rámu.
- Hlavička jamky s průběžným stavem hry (`headerSummary`).
- Home + výsuvné menu (rozhodnutí #28), tlačítko Zpět v hlavičce, History API
  místo routeru (#27), `swipeBack.ts` pro tažení od okraje v PWA.
- Předstartovní skript v `index.html` nastavuje `data-theme` před prvním
  pixelem; `theme.test.ts` hlídá shodu s `theme.tsx`.
- Dvojjazyčná „boot“ hláška při selhání načtení.

Co se pro turnaj mění: Home obrazovka není „nová hra“, ale **leaderboard
turnaje** (Visitor ji vidí bez přihlášení); menu nabízí Kola, Hráči, Týmy,
Pozice, Admin, Účet.

### 2.6 Procesní konvence (AGENTS.md, CONTRIBUTING.md)

Převzít do nového `AGENTS.md`: testy k výpočtům povinné, UI se netestuje
komponentově, `npm run check` před commitem, bump verze při každé změně,
CHANGELOG, texty jen v `i18n`, barvy jen přes proměnné, komentáře „proč“.

---

## 3. Co Golfgames **nemá** a Turecko Cup potřebuje

1. **Víc než 4 hráči v jednom kole.** `Round.players` je `p1`–`p4`, `MAX_PLAYERS = 4`,
   `createRound()` i obrazovky s tím počítají. Turnajové kolo má 8 hráčů ve
   2 flightech.
2. **Sdílený stav mezi zařízeními a uživateli.** Golfgames synchronizuje data
   _jednoho_ účtu; „sdílená kola mezi hráči“ je v `decisions.md` výslovně
   odložená otevřená otázka (pozvání, oprávnění, souběžný zápis).
3. **Role** (Visitor / Player / Administrator) a veřejné čtení bez přihlášení.
   Dnešní `firestore.rules` pouští jen vlastníka k vlastním datům.
4. **Entita turnaj**: soupiska s HCP, týmy, pozice 1–4, kalendář kol, hřiště
   a tee per kolo, konfigurace více her per kolo.
5. **Paralelní vyhodnocení více her** nad stejnými raw skóre a **retrospektivní**
   výpočet (soutěž podle pozic konfigurovaná dodatečně).
6. **Agregace přes kola** (turnajový leaderboard za 5 kol, celkové týmové
   skóre). Golfgames zná jen jedno kolo.
7. **Team Skins** – skins mezi dvěma stranami o 4 hráčích (lepší míč týmu).
   Golfgames má jen individuální skins 2–4 hráčů.
8. **Soutěž podle pozic** (A1 vs B1 …) jako samostatná výsledková vrstva.
9. **Live sdílení průběhu** – více zapisovatelů do jednoho kola současně
   (dva flighty zapisují nezávisle; ideálně každý hráč může zapsat sebe).

---

## 4. Záměrné rozdíly proti Golfgames (nutno zdokumentovat a otestovat)

| #   | Golfgames                                          | Turecko Cup 26                                                                                                        | Důvod                                               |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| R1  | `localStorage` je zdroj pravdy, cloud zrcadlo      | **Firestore je zdroj pravdy** turnaje; `localStorage` jen cache + offline fronta                                      | 8 lidí, 2 flighty, visitoři – data musí být sdílená |
| R2  | Přihlášení je nepovinné a nic nemění               | Čtení veřejné, **zápis vyžaduje přihlášení** Googlem a roli                                                           | spec §4                                             |
| R3  | Rules: jen vlastník                                | Rules: `tournaments/*` čtení pro všechny, zápis skóre pro hráče v kole, konfigurace jen admin (uid/e-mail v `admins`) | spec §4                                             |
| R4  | `Round` = 1–4 hráči, jedna hra                     | `TournamentRound` = 8 hráčů, 2 flighty, **seznam her** (evaluací)                                                     | spec §1, §6, §8                                     |
| R5  | Hra se vybírá při založení kola                    | Hry a soutěž podle pozic jdou **přidat/změnit kdykoli**; raw skóre se nemění                                          | spec §8 „retrospektivní výpočet“                    |
| R6  | Peněžní vyrovnání (`money.ts`)                     | Mimo rozsah v první verzi                                                                                             | spec nezmiňuje peníze                               |
| R7  | Dvojjazyčnost cs/en                                | Jen čeština (i18n infrastruktura zůstává, `en.ts` se nepřidává)                                                       | uzavřená skupina 8 Čechů; šetří čas                 |
| R8  | Konflikty: vyhrává novější `updatedAt` celého kola | Konflikty **per buňka** (hráč × jamka) – zápis nastavuje jen svou buňku přes `updateDoc` s field path                 | dva flighty zapisují současně do jednoho kola       |
| R9  | Smazání skóre jen přidržením hráčem                | Stejně + **admin může opravit cokoli**, oprava se loguje (`audit` pole)                                               | spec §4 „opravovat výsledky“                        |

Pravidla, která **přebíráme beze změny** jako nepřekročitelná: zapsané skóre se
nikdy nemaže změnou nastavení (přepočet místo mazání), kolo si nese kopii
hřiště a nastavení, prázdné skóre má dva významy (nehraná vs. vzdaná jamka,
`isHoleStarted()`), netto rozhoduje o vítězi jamky a brutto o bonusech, pravidla
her žijí jen v `src/games/` a obrazovky je nepočítají, Firebase se importuje
jen dynamicky.

---

## 5. Rizika zjištěná při auditu

- **Čas.** Dnes je 6. 10. 2026, první kolo je 8. 10. 2026. Plán proto musí
  mít ostře oddělené MVP (zápis + Firestore + veřejný leaderboard) od všeho,
  co jde dopočítat zpětně z raw dat.
- **Souběžný zápis do jednoho dokumentu.** Dva flighty = dva telefony píšou do
  stejného kola. Řeší R8 (field-path update) a jeden dokument na kolo; při
  Spark kvótách (50k čtení/20k zápisů denně) je 8 hráčů × 18 jamek × 5 kol
  hluboko pod limitem i s realtime posluchači.
- **Offline na hřišti.** Firestore SDK má offline persistence (`persistentLocalCache`),
  zápisy se zařadí a odešlou po návratu signálu – není třeba vlastní fronta,
  ale musí se otestovat v Safari (IndexedDB v PWA).
- **Google popup na iOS** – převzít přesně mechaniku `preloadAuth()`;
  autorizovaná doména nového hostingu musí být ve Firebase Auth.
- **Lykia Links CR 74,0 vs 74,7** – rozhodnout před kolem 2.
- **Specifikace je neúplná.** Dodaný text končí kapitolou 10 (Course data);
  kapitoly o herních formátech hlavní hry, Team/Individual Skins, bonusech,
  veřejném zobrazení a datovém modelu chybí. Plán pracuje s rozumnými
  předpoklady a označuje je.
