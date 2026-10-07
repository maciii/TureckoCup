# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Patch verzi zvedá `scripts/bump-version.mjs` při každém lokálním buildu.

## [0.4.1] – 2026-10-07

### Přidáno

- Adresa aplikace https://turecko-cup.web.app v dokumentaci.
- Kouřový test živé aplikace po každém nasazení (`npm run test:e2e:live`,
  iPhone ve WebKitu a Android): jen čtení, ostrou databázi nemění.

## [0.4.0] – 2026-10-06

### Změněno

- **Hosting na Firebase místo GitHub Pages.** GitHub Pages zdarma vyžadují
  veřejný repozitář; Firebase Hosting na plánu Spark funguje i ze
  soukromého. Aplikace běží z kořene domény `https://<id-projektu>.web.app`,
  workflow nasazuje přes servisní účet jen s rolí pro Hosting.
- Hlavičky cache: HTML, service worker a manifest bez cache, soubory
  s hashem s roční cache.

### Pro administrátora

- Nový krok v `docs/setup-firebase.md`: Hosting a servisní účet, pátý secret
  `FIREBASE_SERVICE_ACCOUNT`. Doménu `maciii.github.io` už není potřeba
  autorizovat.

## [0.3.0] – 2026-10-06

### Opraveno

- **Anonymní zapisovatel dostane oprávnění:** uid se při přidání do oprávnění
  už nepřevádí na malá písmena (rules ho pak nikdy nepoznaly). Přihlášený
  anonymně vidí své uid ve tvaru, který jde označit a poslat.
- **Pozice v kole se uloží:** editor posílal pole s dírou, které Firestore
  odmítne. Ukládají se vždy čtyři pozice, hráč z jiné pozice se prohodí
  a výběr nabízí jen hráče daného týmu.
- Chyba při sestavení zápisu do Firestoru se ukáže jako hláška místo tichého
  rozdílu mezi obrazovkou a serverem. Oba adaptery kontrolují data podle
  pravidel Firestoru už před zápisem.
- **Log úprav čte jen admin** (záznamy nesou e-maily), e-mail v záznamu nejde
  podvrhnout. Log ukazuje datum i čas a hlásí chybu načtení.
- Bilance duelů pozic v přehledu jmenuje hráče, kteří pozici v jednotlivých
  kolech skutečně hráli, ne hráče z aktuálního kola.
- Odmítnutý zápis kvůli oprávnění řekne, který účet (e-mail nebo uid) admin
  musí přidat, a jmenuje hráče přezdívkou.
- Skript zvyšování verze synchronizuje i `package-lock.json`.
- Zápis odmítnutý proto, že admin mezitím kolo uzavřel, hlásí uzavřené kolo,
  ne chybějící oprávnění.
- Nasazení z `main` už nezruší novější push uprostřed nasazování.
- Tlačítko zvednutí jamky je větší (38 px), odebrání hry chce potvrzení.

### Přidáno

- E2E testy na čtyřech telefonech: iPhone 13 a iPhone SE ve WebKitu, Pixel 7
  a úzký Galaxy S9+ v Chromiu. CI pouští e2e i testy security rules a nasazuje
  jen po jejich úspěchu.
- E2E proti emulátorům Firebase: celý turnajový den přes produkční datovou
  vrstvu a ostré rules (Google admin, anonymní hráč, živá synchronizace,
  zápis bez signálu a jeho odeslání po návratu signálu).
- Hláška o nepovedeném přihlášení obsahuje kód chyby Firebase.
- Test katalogu textů hlídá mrtvé klíče; texty datové vrstvy jsou v katalogu.

### Pro administrátora

- Po nasazení **znovu publikovat `firestore.rules`** v konzoli Firebase.

## [0.2.0] – 2026-10-06

### Změněno

- **Vzhled podle Zavařovák Cupu:** světlý tichý podklad, Inter, skóre
  v barevných pilulkách týmů, seznamy s děliči místo karet, nadpisy sekcí
  s barevným proužkem, scorekarta jako klasická karta po devítkách, kompaktní
  hlavička zápisu jamky s kolečkem a šipkami. Tmavé schéma zrušeno.
- Značky skóre podle golfové konvence: kolečko pod par (birdie červeně,
  eagle zlatě), čtverec nad par (modře), par bez zvýraznění.

### Přidáno

- Log úprav skóre v Admin → kolo, anonymní přihlášení pro hráče bez Googlu,
  testy security rules v emulátoru (`npm run test:rules`).

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
