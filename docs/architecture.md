# Architektura

Jak je aplikace poskládaná. Doplňující čtení: [`games.md`](games.md) (pravidla
her), [`decisions.md`](decisions.md) (proč), [`setup-firebase.md`](setup-firebase.md)
(provoz), [`audit-golfgames.md`](audit-golfgames.md) (co je převzaté z Golfgames).

## Vrstvy

```
screens/        UI; texty přes t(), žádná pravidla her
evaluations/    hry: GameConfig + TournamentRound -> data (řádky, jamky, duely, týmové body)
model/          TournamentRound, Player, GameConfig + čisté výpočty (netto, rány, pořadí jamek)
scoring/        WHS, jádro skins a jamkovky - čisté algoritmy bez modelu
data/           Store: ops (operace), localStore, fireStore, auth, seed
```

Závislosti jdou jen dolů. Obrazovky nikdy nepočítají pravidla - vykreslí, co
vrátí `evaluateRound()` a `summarizeTournament()`. Evaluace nezná React ani
Firestore. `scoring/` nezná ani model turnaje: `computeSkins()` dostane matici
ran stran a `computeMatch()` dvě strany.

## Datový model

Tvar odpovídá dokumentům ve Firestore 1:1 (`src/model/types.ts`):

```
tournaments/{tid}                       Tournament: název, týmy, playerIds
tournaments/{tid}/private/access        Access: adminEmails, playerEmails {p1: e-mail} (čtou hráči a admin)
tournaments/{tid}/players/{pid}         Player: jméno, tým, pozice, HCP index
tournaments/{tid}/rounds/{rid}          TournamentRound (níž)
tournaments/{tid}/rounds/{rid}/edits/*  EditRecord: kdo, kdy, kterou buňku, odkud kam (čte jen admin)
```

```ts
interface TournamentRound {
  id: 'r1'                       // r1..r5
  number, date, status           // 'planned' | 'live' | 'finished'
  course: CourseSnapshot         // hluboká kopie z katalogu: pars, SI, tees (CR/SR)
  defaultTeeId, playerTees       // odpaliště kola a výjimky per hráč
  playerIndex                    // snímek HCP indexů pro tohle kolo
  courseHandicapOverride         // ruční přepis hracího HCP (celé rány)
  flights: [{ players, startHole, teeTime }]  // teeTime 'HH:MM', místní čas
  departure                      // hromadný odjezd 'HH:MM'; '' / chybí = nezadaný
  positions: { A: [p..], B: [p..] }   // snímek pozic 1-4
  games: GameConfig[]            // viz games.md
  scores: { p1: { '0': 4, '1': 0 } }  // mapa hráč -> jamka -> rány; 0 = zvednuto
  bonuses: { p1: { '4': ['longest'] } }
  lastEdit: { playerId, hole, by, at }
}
```

Invarianty:

- **Raw skóre je jediný zdroj.** Nic odvozeného se neukládá.
- **Žádné pole v poli** - Firestore ho odmítne. Proto flighty a strany jsou
  objekty a skóre mapa map.
- **Kolo si nese snímek** hřiště, indexů, odpališť a pozic. Změna u hráče se
  promítne do dalších kol (seed i „Obnovit konfiguraci kola“), odehraná se
  nepřepočítají.
- **Prázdné mapy pro všech osm** (`scores.p8 = {}`) existují od založení -
  rules sahají na `resource.data.scores[p]`.

## Datová vrstva

`src/data/store.ts` definuje rozhraní `Store` (subscribe, dispatch, auth).
Změny jsou operace `Op` v `src/data/ops.ts`; `applyOp()` je aplikuje na
místní stav a `opToWrites()` je přeloží na zápisy do Firestore. Obě jsou čisté
a test `ops.test.ts` hlídá, že dávají totéž - ukázkový režim tak nelže.

Před každou změnou oba adaptery zavolají společnou `checkOp()` (role jako
rules, data přes `findInvalidWrite()`):
Firestore odmítne `undefined` (i jako díru v poli) a pole v poli, ale
localStorage by je přijal. Kontrola tak chybu ukáže už v ukázkovém režimu
a v e2e testech, ne až na hřišti. Ukázkový režim také odmítne admin operaci
zapisovateli, stejně jako rules.

| Adapter           | Kdy                                  | Jak                                                                  |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `localStore.ts`   | `import.meta.env.DEV` nebo `?demo=1` | localStorage + `storage` event (2 záložky = 2 flighty), falešná role |
| `localStore.ts`   | `?demo=4dny` (varianta `preview`)    | totéž s vlastními klíči `tc26.preview.*`, data z `preview.ts`        |
| `fireStore.ts`    | produkční build s `VITE_FIREBASE_*`  | `onSnapshot` na turnaj/hráče/kola, `writeBatch` z `opToWrites`       |
| (bez konfigurace) | produkční build bez secrets          | blokující hláška „Turnaj není připojený“, nikdy tichý localStorage   |

**Testovací verze** (`?demo=4dny`, `src/data/preview.ts`) je vymyšlený turnaj
po čtyřech dnech: kola 1-3 dohraná, 4 rozehrané (flight 2 na 15. jamce),
5 plánované. Každý den má jinou sadu her (všech pět druhů, netto i brutto,
allowance, rozsah jamek, přenos banku, různé bodování), jiné pozice,
odpaliště, ruční HCP i startovní jamku. Skóre losuje deterministický
generátor z pevného semínka, takže všichni na odkazu vidí totéž; menu umí
vylosovat nová data. Ukládá se jen raw skóre a konfigurace jako v ostrém
turnaji. V hlavičce každé obrazovky je štítek „Test“.

Zápis skóre je vždy jedna buňka: `update(rounds/r1, { 'scores.p3.7': 5,
lastEdit })` plus záznam do `edits`. Zápisy se **neawaitují** - offline promise
nedoběhne, stav „čeká na odeslání“ dává `hasPendingWrites` ze snímku kola,
pozdní odmítnutí (rules po návratu signálu) se zachytí z promise do
`meta.error`. Firestore má trvalou cache (`persistentLocalCache`, multi-tab)
s fallbackem na paměť v privátním režimu. Firebase chunk je **předcachovaný**
service workerem - bez něj by aplikace bez signálu nenaběhla.

### Role

| Role    | Jak se pozná                                                          | Smí                                                          |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Visitor | nepřihlášen                                                           | číst turnaj, hráče a kola (ne oprávnění ani log úprav)       |
| Hráč    | přihlášen Googlem; e-mail v `playerEmails` u jeho jména               | měnit jednu buňku skóre/bonusů v kole, které není `finished` |
| Admin   | e-mail v `adminEmails` nebo bootstrap `mac.kubecka@gmail.com` v rules | vše                                                          |

Po přihlášení klient přečte `private/access` (smí jen hráč nebo admin) a
funkcí `resolveIdentity()` pozná roli i hráče: obrazovky ukazují jméno ze
soupisky místo Google účtu. Cizí účet (rules čtení odmítnou) aplikace
odhlásí s hláškou; přihlásit se tedy smějí jen hráči a admin. Anonymní
přihlášení není. E-maily jsou malými písmeny a každý patří jednomu hráči.
Log úprav nese e-mail zapisovatele, proto ho čte jen admin, rules nedovolí
e-mail podvrhnout a admin v něm vidí jméno hráče.
Detaily pravidel jsou
v [`../firestore.rules`](../firestore.rules).

## Evaluace

`evaluateGame(round, players, game)` vrací `EvaluationResult`: seřazené řádky
(`rows`), stav jamek (`holes`), duely a `teamPoints`. `summarizeTournament()`
sečte přes kola týmové body (jen hry s `countsForTeam`), Stableford a skiny
jednotlivců a bilanci duelů pozic. Všechno jsou data; texty skládá UI.

Jamka je **rozhodnutá**, až když zapsali všichni, kterých se hra týká. Do té
doby bank Skins stojí a duel ji nepočítá - visitor nikdy neuvidí skin „dočasně“
u hráče jen proto, že zapsal první.

## Navigace a stav UI

Hash v adrese (`#/round/r1`, `#/play/r1/0`, `#/admin`): zpět/swipe funguje
přes historii prohlížeče, obrazovka přežije obnovení stránky (service worker
v režimu `autoUpdate` umí aplikaci znovu načíst) a odkaz jde poslat. Jamka,
na kterou zapisovatel sám přešel, se drží v localStorage per kolo a flight;
jinak zápis otevře jamku, kde flight je (`flightCurrentHole`).

Program kola (`src/model/schedule.ts`): úvodní obrazovka ukazuje odjezd
a tee time „nejbližšího kola“ - rozehraného, jinak prvního plánovaného od
dneška. Časy jsou text `HH:MM` v místním čase Beleku, bez časových pásem.
Zápis ukazuje štítek s postupem druhého flightu; klepnutí otevře jen náhled
(rány proti paru, Stableford, Team Skins), zápis zůstává u vlastního flightu.

## Build a nasazení

`vite.config.ts`: PWA manifest, aplikace z kořene domény, Firebase ve
vlastním chunku (předcachovaném). `firebase.json` nastavuje Hosting: HTML,
service worker a manifest bez cache (nová verze se projeví hned), soubory
s hashem v `assets/` s roční cache. Workflow `deploy.yml` na každém
pushi kontroluje typy, testy a formát, pouští e2e testy na telefonech
(iOS ve WebKitu, Android v Chromiu) a testy security rules v emulátoru;
z `main` nasazuje na Firebase Hosting (akce `action-hosting-deploy`, servisní
účet s rolemi pro Hosting a pravidla), jen když prošlo všechno. Nejdřív
nasadí `firestore.rules`, pak aplikaci - když pravidla selžou, zůstane
předchozí verze aplikace. Konfigurace Firebase
se bere ze Secrets (viz [`setup-firebase.md`](setup-firebase.md)).

## Testy

- `src/scoring/*.test.ts` - WHS (převzaté z Golfgames), skins, jamkovka
- `src/evaluations/evaluations.test.ts` - hry nad reálným kolem 1 (Aspendos)
- `src/data/ops.test.ts` - shoda `applyOp` a field-path zápisů
- `src/model/round.test.ts` - pozice bez děr, kontrola dat pro Firestore
- `src/i18n/i18n.test.ts` - úplnost katalogu, žádné mrtvé klíče
- `e2e/` - Playwright v ukázkovém režimu na čtyřech telefonech: iPhone 13
  a iPhone SE (WebKit), Pixel 7 a úzký Galaxy S9+ 320 px (Chromium). Hlavní
  cesta turnaje, ovládání zápisu, administrace (pozice, oprávnění, log úprav,
  hry), layout bez vodorovného přetečení a bez chyb v konzoli
- `e2e-firebase/` - Playwright proti emulátorům Auth a Firestore s ostrými
  rules (`npm run test:e2e:firebase`): admin se přihlásí Googlem a založí
  turnaj, uloží pozice, přiřadí hráči e-mail, cizí Google účet aplikace
  odhlásí, hráč se pozná jménem a zapisuje, admin vidí jeho jméno v logu
  úprav a visitor na třetím telefonu vidí
  skóre živě. Druhý scénář vypne signál: zápis se ukáže hned s odznakem
  „neodesláno“, jde zapisovat dál a po návratu signálu se odešle. iOS profil
  (WebKit) jede přes long polling Firestoru, viz rozhodnutí 14. V CI jde
  přihlášení skutečným popupem emulátoru, lokálně
  (bez přístupu na apis.google.com) přes testovací háček ve vývojovém buildu
- `rules/` - testy `firestore.rules` v emulátoru (`npm run test:rules`), i v CI
- `e2e-live/` - kouřový test živé aplikace https://turecko-cup.web.app po každém
  nasazení (`npm run test:e2e:live`): visitor bez přihlášení, PWA manifest
  a service worker, ukázkový režim. Jen čte, ostrou databázi nemění
