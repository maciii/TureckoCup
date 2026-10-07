# Nastavení Firebase a nasazení (checklist pro administrátora)

Aplikace běží bez vlastního serveru. Firebase (plán **Spark**, zdarma, bez
platební karty) dodává všechno: Hosting servíruje statickou PWA, přihlášení
Googlem a databázi Firestore. Repozitář může zůstat soukromý. Tenhle postup
musí udělat administrátor ručně, vývoj k Firebase přístup nemá. Zabere asi
30 minut.

Adresa aplikace pro turnaj: **https://turecko-cup.web.app** (projekt Firebase
`turecko-cup`). Vlastní doména až
po turnaji, změna adresy by všem zrušila instalaci PWA i přihlášení.

## 1. Projekt Firebase

1. https://console.firebase.google.com → **Add project** → název např.
   `turecko-cup`. Google Analytics vypnout.
2. Plán nechat **Spark**. Blaze nikdy nezapínat.

## 2. Přihlášení

1. Build → **Authentication** → Get started.
2. Sign-in method → **Google** → Enable → vyplnit support e-mail → Save.
3. Sign-in method → **Anonymous** → Enable (záloha pro hráče bez Google účtu).
4. Settings → **Authorized domains**: domény `turecko-cup.web.app`
   a `turecko-cup.firebaseapp.com` tam Firebase přidá sám, nic se
   nedoplňuje.

## 3. Databáze

1. Build → **Firestore Database** → Create database.
2. Název nechat `(default)`, umístění **`eur3 (europe-west)`** (nejde později
   změnit), režim **Production**.
3. Záložka **Rules** → smazat obsah → vložit celý soubor
   [`firestore.rules`](../firestore.rules) z repozitáře → **Publish**.
   Bez tohoto kroku nejde zapisovat a visitoři nic neuvidí.

## 4. Konfigurace webové aplikace

1. Project settings (ozubené kolo) → **Your apps** → ikona `</>` (Web) →
   nickname `tureckocup` → zaškrtnout **Also set up Firebase Hosting** →
   Register app. Kroky s instalací CLI a `firebase deploy` přeskočit,
   nasazuje GitHub.
2. Z ukázky `firebaseConfig` opsat čtyři hodnoty:

   | Hodnota      | Kam                         |
   | ------------ | --------------------------- |
   | `apiKey`     | `VITE_FIREBASE_API_KEY`     |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId`  | `VITE_FIREBASE_PROJECT_ID`  |
   | `appId`      | `VITE_FIREBASE_APP_ID`      |

   Údaje nejsou tajné (u Firebase jsou veřejné z principu), zabezpečení stojí
   na pravidlech z kroku 3.

## 5. Přístup GitHubu k Firebase Hosting (servisní účet)

GitHub nasazuje pod servisním účtem, který smí jen nahrávat Hosting.

1. Build → **Hosting** → Get started → průvodce proklikat (CLI kroky
   přeskočit). Tím vznikne web `turecko-cup.web.app`.
2. https://console.cloud.google.com/iam-admin/serviceaccounts → nahoře
   vybrat projekt Firebase → **Create service account** → název
   `github-deploy` → Create and continue.
3. Role přidat dvě: **Firebase Hosting Admin** a **API Keys Viewer** →
   Continue → Done.
4. Klepnout na nový účet → záložka **Keys** → Add key → Create new key →
   **JSON** → stáhne se soubor. Je to heslo k nasazení: nikam ho
   neposílat, po vložení do GitHubu z počítače smazat.

## 6. GitHub repozitář

1. Settings → Secrets and variables → **Actions** → záložka Secrets →
   New repository secret, celkem pět (na úrovni repozitáře, ne
   v Environment):

   | Secret                      | Hodnota                             |
   | --------------------------- | ----------------------------------- |
   | `VITE_FIREBASE_API_KEY`     | z kroku 4                           |
   | `VITE_FIREBASE_AUTH_DOMAIN` | z kroku 4                           |
   | `VITE_FIREBASE_PROJECT_ID`  | z kroku 4                           |
   | `VITE_FIREBASE_APP_ID`      | z kroku 4                           |
   | `FIREBASE_SERVICE_ACCOUNT`  | celý obsah JSON souboru z kroku 5.4 |

2. Actions → workflow **Build & Deploy** → Run workflow (větev `main`),
   nebo jakýkoli push do `main`. Krok „Kontrola konfigurace Firebase“ v logu
   vypíše u každé hodnoty „vyplněno“ nebo „CHYBÍ“; nasazení samo hlásí
   chybějící `FIREBASE_SERVICE_ACCOUNT`.
3. Po zeleném běhu je aplikace na `https://turecko-cup.web.app`.

## 7. První spuštění

1. Otevřít `https://turecko-cup.web.app` v Safari (iPhone) nebo
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
   Hráč bez Google účtu se v Admin přihlásí tlačítkem „Nemám Google účet“,
   pošle adminovi zobrazené uid a admin ho vloží tlačítkem **+ uid** (přesně,
   záleží na velikosti písmen).
6. V Admin → **Kolo** zkontrolovat odpaliště, HCP indexy a hrací handicapy,
   rozdělení do flightů; kolo přepnout na **Živé** ráno před startem.

### Aktualizace pravidel

Při každé změně souboru [`firestore.rules`](../firestore.rules) v repozitáři
je potřeba pravidla znovu vložit v konzoli (krok 3). Workflow nasazuje jen
Hosting, pravidla databáze ne - záměrně, servisní účet k databázi nesmí. Od verze 0.3.0 čte log
úprav jen admin a rules nedovolí podvrhnout e-mail v záznamu - **po nasazení
0.3.0 pravidla znovu publikovat.**

### Přihlášení na iPhonu (když popup nefunguje)

Safari na iPhonu blokuje úložiště třetích stran. Když přihlášení Googlem
v nainstalované aplikaci opakovaně selže, přesune se přihlašovací stránka na
doménu aplikace. Udělat **oba kroky**, jinak Google přihlášení odmítne:

1. https://console.cloud.google.com/apis/credentials → OAuth 2.0 Client IDs →
   **Web client (auto created by Google Service)** → Authorized redirect
   URIs → Add URI → `https://turecko-cup.web.app/__/auth/handler` → Save.
2. V GitHubu změnit secret `VITE_FIREBASE_AUTH_DOMAIN` na
   `turecko-cup.web.app` a spustit workflow znovu.

## 8. Zkouška nanečisto (doporučeno 7. 10.)

- Dva telefony zapisují každý svůj flight, třetí zařízení bez přihlášení
  sleduje Přehled.
- Jeden telefon do letadlového režimu na 3 jamky, zapsat, **zabít aplikaci**
  ze seznamu aplikací, otevřít znovu offline (musí naběhnout a ukázat
  „neodesláno“), zapnout signál a ověřit na druhém telefonu.
- Po zkoušce v Admin → Kolo použít **Vymazat skóre kola** (jen admin).

## Časté problémy

| Projev                                    | Příčina                                                     |
| ----------------------------------------- | ----------------------------------------------------------- |
| „Turnaj není připojený“                   | chybí secrets v GitHubu (krok 6) nebo build běžel bez nich  |
| Nasazení: „Chybí secret …“                | doplnit secret z kroku 6                                    |
| Nasazení: 403, „does not have permission“ | servisnímu účtu chybí role z kroku 5.3                      |
| Přihlášení se otevře a hned zavře         | blokované vyskakovací okno; zkusit v nainstalované PWA      |
| „Zápis odmítnut“                          | e-mail nebo uid není v oprávněních, nebo kolo je uzavřené   |
| Visitor nic nevidí, „Chybí oprávnění“     | nenasazená pravidla (krok 3)                                |
| Data se neukládají, „Chybí oprávnění“     | e-mail není ověřený u Googlu, nebo chybí v `private/access` |
