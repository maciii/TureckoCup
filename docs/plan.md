# Turecko Cup 26 – plán vývoje a stav

Plán vychází ze specifikace v3 (dodané kapitoly 1–10), z auditu
referenčních projektů ([`audit-golfgames.md`](audit-golfgames.md)) a
z oponentury plánu (Opus 5.5, 6. 10. 2026), která přepsala původní návrh
v několika podstatných bodech - viz [`decisions.md`](decisions.md). Kde
specifikace mlčí, platí předpoklad označený `[P]`, který administrátor může
změnit konfigurací v aplikaci.

**Kritický termín:** první kolo je **8. 10. 2026**.

## Stav k 6. 10. 2026

| Fáze                                            | Stav                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| 0 Základ projektu                               | hotovo                                                               |
| 1 MVP (model, evaluace, datová vrstva, obrazovky)| hotovo, `npm run check` a Playwright smoke zelené                     |
| 2 Pozice, agregace, hlavní hra                  | duely pozic a agregace přes kola hotové; hlavní hra čeká na rozhodnutí |
| Provoz                                          | **čeká na administrátora** – Firebase a GitHub podle `setup-firebase.md` |

### Co musí udělat administrátor (blokuje ostrý provoz)

1. Projít [`setup-firebase.md`](setup-firebase.md): Firebase projekt,
   Google + Anonymous přihlášení, Firestore `eur3`, **vložit
   `firestore.rules`**, authorized domain `maciii.github.io`, čtyři secrets
   do GitHubu, Pages = GitHub Actions.
2. Otevřít https://maciii.github.io/TureckoCup/ v nainstalované PWA,
   přihlásit se jako `mac.kubecka@gmail.com`, **Inicializovat turnaj**.
3. Doplnit oprávnění zapisovatelů (e-maily), HCP indexy čtyř hráčů, týmy,
   pozice, odpaliště a flighty; rozhodnout formát hlavní hry (kap. 4).
4. Zkouška nanečisto 7. 10. (dva telefony, letadlový režim, zabití aplikace).

Do té doby jde všechno vyzkoušet v ukázkovém režimu
(`?demo=1`, identita se přepíná v menu).

## 1. Cíl a hranice

Samostatná PWA (`maciii/TureckoCup`, vlastní Firebase projekt, GitHub Pages
pod `/TureckoCup/`). Golfgames se nemění; převzaté jsou WHS výpočty,
infrastruktura, design a mechanika přihlášení. Mimo rozsah: peníze,
angličtina, ruční zadávání hřišť, extra body v UI.

## 2. Architektura (jak je postavená)

Podrobně v [`architecture.md`](architecture.md). Ve zkratce:

- **Firestore je zdroj pravdy**, jeden dokument na kolo, skóre jako mapa
  `hráč → jamka → rány`, zvednutí = `0`. Jeden zápis = jedna buňka
  (field-path update + `lastEdit` + záznam v `edits`).
- **Role:** visitor (čte vše), zapisovatel (whitelist e-mailů v
  `private/access`), admin (whitelist + bootstrap e-mail v rules).
- **Hry jsou konfigurace** kola (`GameConfig`), vyhodnocují se nezávisle
  nad raw daty, jdou měnit i po dohrání. Evaluace vrací data.
- **Datová vrstva** `Store` se dvěma adaptery (localStorage pro ukázku a
  e2e, Firestore pro produkci); `applyOp` a `opToWrites` jsou čisté a test
  hlídá jejich shodu.
- **Obrazovky:** Přehled, Kolo (výsledky + scorekarta), Zápis, Admin,
  Admin → kolo. Design a CSS tokeny Golfgames.
- **Offline:** Firestore trvalá cache, Firebase chunk předcachovaný, zápisy
  se neawaitují, stav z `hasPendingWrites`, UI stav přežije reload.

## 3. Co zbývá a pořadí

1. **Během turnaje, podle potřeby:**
   - hlavní hra kola (`team-match` je implementovaná, chybí rozhodnutí
     o formátu a bodování; admin ji přidá v Admin → kolo → Přidat hru),
   - log úprav v UI (zapisuje se už teď),
   - extra body (model a rules hotové, UI a vyhodnocení ne),
   - anonymní přihlášení v UI pro hráče bez Googlu (rules a adapter hotové).
2. **Po turnaji:** vlastní doména, export výsledků, archiv.
3. **Testy rules v emulátoru** (`npm run test:rules`) – lokálně, mimo CI.

## 4. Rozhodnutí administrátora (předpoklady `[P]` v aplikaci)

| Téma                     | Výchozí stav v aplikaci                                       | Kde změnit                 |
| ------------------------ | ------------------------------------------------------------- | -------------------------- |
| Odpaliště                | bílá pro všechny `[P]`                                        | Admin → kolo → Odpaliště   |
| Hlavní hra kola          | není; týmové skóre tvoří jen Team Skins (označeno předběžné)  | Admin → kolo → Hry         |
| Team Skins               | lepší netto míč týmu, přenos banku, 1 bod za skin `[P]`       | Admin → kolo → Hry         |
| Individual Skins         | ve flightu `[P]`, přenos banku                                | Admin → kolo → Hry         |
| Allowance                | 100 % `[P]`                                                   | Admin → kolo → Hry         |
| Duely pozic              | netto rány `[P]`, nevstupují do týmového skóre                | Admin → kolo → Hry         |
| Týmy a pozice            | zástupné rozdělení ze seedu `[P]`                             | Admin → Hráči, Admin → kolo |
| Flighty                  | A1 A2 B1 B2 / A3 A4 B3 B4 `[P]`, start z jedničky             | Admin → kolo → Flighty     |
| Lykia Links CR           | 74,7 (slope tabulka) `[P]`                                    | ruční přepis hracího HCP   |
| Chybějící HCP            | Soldík, Jarin, Radek, Honza hrají s nulou a otazníkem         | Admin → Hráči              |
| Zapisovatelé             | `mac.kubecka@gmail.com`, `bezdekf@gmail.com`                  | Admin → Oprávnění          |

## 5. Rizika a opatření

| Riziko                                  | Opatření                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Firebase není nastavená do 8. 10.       | aplikace běží v ukázkovém režimu na jednom telefonu; skóre lze přepsat do Firestoru později přes Admin (opravy) |
| Google popup blokovaný na iOS           | převzatý `preloadAuth()`, návod: nejdřív instalovat PWA, pak se přihlásit v ní |
| Souběžný zápis dvou flightů             | jedna buňka na zápis, rules kontrolují vnořenou úroveň                     |
| Výpadek signálu                         | trvalá cache Firestoru, zápis nikdy nečeká na síť, odznak „neodesláno“    |
| Chyba v hracím HCP                      | tabulka v Admin → kolo s ručním přepisem; test s reálnými CR/SR           |
| Změna formátu her během turnaje         | hry jsou konfigurace, raw skóre se nemění                                 |
