# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Patch verzi zvedá `scripts/bump-version.mjs` při každém lokálním buildu.

## [0.7.0] – 2026-10-07

### Přidáno

- **Program kola na úvodní obrazovce:** hromadný odjezd na hřiště a tee time
  obou flightů se jmény hráčů pro rozehrané nebo nejbližší kolo. Seznam kol
  ukazuje tee time u kol, která se teprve hrají.
- Admin zadá odjezd a tee time v nastavení kola (oddíl Flighty). Stačí napsat
  `1550` nebo `15:50`; čas prvního flightu doplní druhému o 10 minut později.
  První kolo má v seedu odjezd 14:45 a tee time 15:50 a 16:00.
- **Náhled druhého flightu při zápisu:** štítek „Flight 2 · 7. jamka“ otevře
  přehled hráčů druhého flightu (jamky, rány proti paru, Stableford) a stav
  Team Skins; tlačítko „Zpět na flight 1“ vrátí na rozepsanou jamku.
- Výběr flightu v zápisu ukazuje tee time; testovací verze má program
  u všech kol.

### Opraveno

- Na úzkém Androidu se v zápisu zkracovala jména („Ja…“), když se u nich
  ukazovaly body za jamku. Body jsou teď pod jménem vedle součtu ran.

## [0.6.0] – 2026-10-07

### Přidáno

- **Testovací verze** na https://turecko-cup.web.app/?demo=4dny (odkaz
  v menu): vymyšlený turnaj po čtyřech dnech. Tři kola dohraná, čtvrté
  rozehrané (flight 2 na 15. jamce), páté naplánované. Každý den jiné hry:
  Stableford netto, brutto i s 90 % allowance, Skins ve flightu, přes všech
  osm, brutto, bez přenosu i jen na přední devítce, Team Skins s přenosem,
  bez něj i na zadní devítce za 2 body, duely pozic netto, brutto, jamkovkou
  i na body a four-ball dvojic. Jiné pozice, odpaliště, ruční HCP a start
  druhého flightu z desítky. Dá se v ní zapisovat i měnit hry; všechno
  zůstává jen v prohlížeči, menu umí vylosovat nová data.
- Admin může u hry změnit **název** a **rozsah jamek** (např. jen přední
  devítka). Popisek hry ve výsledcích rozsah ukazuje.

### Opraveno

- Zápis otevřený přímo odkazem (nebo po načtení stránky) skočí na jamku, kde
  flight je. Dřív se uložila jamka 1 dřív, než dorazila data, a zůstala.
- Změna druhu hry zahodí vlastní název původní hry; týmový zápas dostane
  dvojice z flightů, jinak by nic nevyhodnotil.
- Popisek Skins přes všech osm už netvrdí „ve flightu“; strany týmového
  zápasu se v nastavení ukazují po zápasech.
- Seed: přezdívky Ferry a Vrbič jako v ostrém turnaji.

## [0.5.1] – 2026-10-07

### Opraveno

- **Rychlé úpravy nastavení za sebou se neztrácejí.** Snímek ze serveru, který
  dorazil mezi úpravou a jejím odesláním, vrátil obrazovku do starého stavu
  a další úprava pozic, her nebo flightů pak přepsala tu první. Neodeslané
  změny se teď na každý snímek použijí znovu, dokud je Firestore nepotvrdí.
- Kouřový test živé aplikace počítá s přihlášením bez anonymní varianty.

## [0.5.0] – 2026-10-07

### Změněno

- **Každý hráč má v soupisce svůj Google e-mail** (Admin → Hráči). Po
  přihlášení aplikace ukazuje jméno hráče, log úprav ukazuje, který hráč co
  zapsal.
- **Přihlásit se smějí jen hráči a admin.** Cizí Google účet aplikace hned
  odhlásí s hláškou; pravidla mu nedovolí zapisovat ani číst e-maily.
  Anonymní přihlášení a seznam zapisovatelů (e-maily, uid) jsou zrušené.
- Oprávnění v administraci už spravují jen administrátory.
- Workflow nasazuje pravidla Firestoru sám, vždy před aplikací.

### Pro administrátora

- Servisnímu účtu `github-deploy` přidat role **Firebase Rules Admin**
  a **Service Usage Consumer** (návod, krok 5.3). Bez nich se nová verze
  nenasadí.
- Po nasazení doplnit e-maily všech hráčů v Admin → Hráči. Dřívější seznam
  zapisovatelů se nepřevádí.

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
