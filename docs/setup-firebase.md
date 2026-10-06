# Nastavení Firebase a nasazení (checklist pro administrátora)

Aplikace běží bez vlastního serveru: GitHub Pages servíruje statickou PWA
a Firebase (plán **Spark**, zdarma, bez platební karty) dodává přihlášení
Googlem a databázi Firestore. Tenhle postup musí udělat administrátor ručně,
vývoj k Firebase přístup nemá. Zabere asi 20 minut.

Adresa aplikace pro turnaj: **https://maciii.github.io/TureckoCup/**
(vlastní doména až po turnaji, změna adresy by všem zrušila instalaci PWA
i přihlášení).

## 1. Projekt Firebase

1. https://console.firebase.google.com → **Add project** → název např.
   `turecko-cup-26`. Google Analytics vypnout.
2. Plán nechat **Spark**. Blaze nikdy nezapínat.

## 2. Přihlášení

1. Build → **Authentication** → Get started.
2. Sign-in method → **Google** → Enable → vyplnit support e-mail → Save.
3. Sign-in method → **Anonymous** → Enable (záloha pro hráče bez Google účtu).
4. Settings → **Authorized domains** → Add domain → `maciii.github.io`.

## 3. Databáze

1. Build → **Firestore Database** → Create database.
2. Název nechat `(default)`, umístění **`eur3 (europe-west)`** (nejde později
   změnit), režim **Production**.
3. Záložka **Rules** → smazat obsah → vložit celý soubor
   [`firestore.rules`](../firestore.rules) z repozitáře → **Publish**.
   Bez tohoto kroku nejde zapisovat a visitoři nic neuvidí.

## 4. Konfigurace webové aplikace

1. Project settings (ozubené kolo) → **Your apps** → ikona `</>` (Web) →
   nickname `tureckocup` → Register app (Hosting nezaškrtávat).
2. Z ukázky `firebaseConfig` opsat čtyři hodnoty:

   | Hodnota      | Kam                         |
   | ------------ | --------------------------- |
   | `apiKey`     | `VITE_FIREBASE_API_KEY`     |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId`  | `VITE_FIREBASE_PROJECT_ID`  |
   | `appId`      | `VITE_FIREBASE_APP_ID`      |

   Údaje nejsou tajné (u Firebase jsou veřejné z principu), zabezpečení stojí
   na pravidlech z kroku 3.

## 5. GitHub repozitář

1. Settings → Secrets and variables → **Actions** → záložka Secrets →
   New repository secret → čtyři hodnoty z kroku 4 (musí být na úrovni
   repozitáře, ne v Environment).
2. Settings → **Pages** → Source: **GitHub Actions**.
3. Settings → Environments → `github-pages` → Deployment branches: povolit
   `main` (bývá výchozí).
4. Push do `main` spustí workflow `Build & Deploy`. Krok „Kontrola
   konfigurace Firebase“ v logu vypíše u každé hodnoty „vyplněno“ nebo
   „CHYBÍ“.

## 6. První spuštění

1. Otevřít https://maciii.github.io/TureckoCup/ v Safari (iPhone) nebo
   Chrome (Android).
2. **Nejdřív přidat na plochu** (Sdílet → Přidat na plochu), **pak** otevřít
   z ikony a teprve tam se přihlásit. Instalovaná PWA má na iOS oddělené
   úložiště od Safari, přihlášení ze Safari se do ní nepřenese.
3. Menu → **Admin** → Přihlásit se Googlem účtem `mac.kubecka@gmail.com`
   (bootstrap administrátor je napevno v pravidlech).
4. Klepnout **Inicializovat turnaj** – založí turnaj, 8 hráčů, 5 kol se
   snímky hřišť a seznam oprávnění.
5. V Admin → **Oprávnění** doplnit e-maily zapisovatelů (Google účty hráčů,
   kteří budou zapisovat skóre). V každém flightu musí být aspoň jeden.
6. V Admin → **Kolo** zkontrolovat odpaliště, HCP indexy a hrací handicapy,
   rozdělení do flightů; kolo přepnout na **Živé** ráno před startem.

## 7. Zkouška nanečisto (doporučeno 7. 10.)

- Dva telefony zapisují každý svůj flight, třetí zařízení bez přihlášení
  sleduje Přehled.
- Jeden telefon do letadlového režimu na 3 jamky, zapsat, **zabít aplikaci**
  ze seznamu aplikací, otevřít znovu offline (musí naběhnout a ukázat
  „neodesláno“), zapnout signál a ověřit na druhém telefonu.
- Po zkoušce v Admin → Kolo použít **Vymazat skóre kola** (jen admin).

## Časté problémy

| Projev                                | Příčina                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| „Turnaj není připojený“               | chybí secrets v GitHubu (krok 5) nebo build běžel bez nich  |
| Přihlášení se otevře a hned zavře     | blokované vyskakovací okno; zkusit v nainstalované PWA      |
| „Zápis odmítnut“                      | e-mail není v oprávněních, nebo kolo je uzavřené            |
| Visitor nic nevidí, „Chybí oprávnění“ | nenasazená pravidla (krok 3)                                |
| Data se neukládají, „Chybí oprávnění“ | e-mail není ověřený u Googlu, nebo chybí v `private/access` |
