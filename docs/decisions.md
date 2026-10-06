# Rozhodnutí a jejich důvody

Formát: kontext → rozhodnutí → důsledek. Rozhodnutí převzatá z Golfgames
(PWA na Pages, Spark, tmavé a světlé schéma, zápis par doprostřed, testuje se
matematika) tu nejsou zopakovaná - viz `docs/decisions.md` tam.

## 1. Firestore je zdroj pravdy, ne localStorage

**Kontext.** Golfgames má data v telefonu a cloud jako zrcadlo jednoho účtu.
Turnaj potřebuje 8 lidí, dva flighty zapisující současně a visitory.

**Rozhodnutí.** Firestore je zdroj pravdy; localStorage jen UI stav. Firestore
má trvalou cache a zápisy se neawaitují, takže offline zápis zůstává okamžitý.

**Důsledek.** Produkce bez konfigurace Firebase nesmí tiše spadnout na
localStorage - ukáže blokující hlášku. Ukázkový režim jen ve vývoji nebo
s `?demo=1`.

## 2. Vlastní model a evaluace místo projekce na `Round` z Golfgames

**Kontext.** Plán původně počítal s projekcí turnajového kola na `Round`
z Golfgames, aby šly převzít hry i s testy.

**Rozhodnutí.** Převzít jen čisté WHS funkce a algoritmy (skins, jamkovka)
přepsat nad maticí stran. Hry jsou zhruba 50 řádků každá a vrací data.

**Proč.** `Round` táhne 2 500 řádků s `settings.options`, kde výchozí
`doubleClosingHoles: true` by tiše zdvojnásobil 9. a 18. jamku, bonusy mají
nenulové hodnoty a `isHoleStarted()` neumí „jamka čeká na druhý flight“.

## 3. Zvednutí je explicitní nula

**Kontext.** Golfgames odvozuje vzdanou jamku z chybějícího zápisu, protože
všechna čtyři skóre zapisuje jedno zařízení naráz. Tady se každá buňka posílá
zvlášť a visitor vidí každý mezistav.

**Rozhodnutí.** `0` = zvednuto, chybějící klíč = nezapsáno. Jamka je ve hře
rozhodnutá, až když zapsali všichni, kterých se týká.

**Důsledek.** Bank Skins se nemění, dokud flight nedohraje jamku; Team Skins
čekají na všech osm.

## 4. Jeden zápis = jedna buňka

**Rozhodnutí.** Zápis skóre je `update` jediné field path plus `lastEdit`,
rules kontrolují i vnořenou úroveň mapy.

**Proč.** Dva flighty píšou do jednoho dokumentu a nesmí si přepsat skóre.
Zároveň hráč nemůže jedním zápisem smazat skóre všem.

## 5. Role přes whitelist e-mailů, bez vazby účet → hráč

**Rozhodnutí.** `private/access` drží e-maily adminů a zapisovatelů (plus uid
anonymních účtů). Zapisovatel smí zapsat kteréhokoli hráče. Bootstrap admin je
napevno v rules kvůli prvnímu založení.

**Proč.** Čtyři hráči nemají Google účet; zapisuje za ně markér flightu.
Vazba účet → hráč by byla složitost bez užitku.

## 6. Snímky v kole: index, odpaliště, pozice

**Rozhodnutí.** Kolo si nese `playerIndex`, `playerTees`, `positions` a
`courseHandicapOverride`; allowance se aplikuje ve hře.

**Proč.** Změna indexu nebo pozice třetí den nesmí přepočítat odehraná kola.
Allowance per hra, aby stejné kolo mohlo mít Skins na 100 % a zápas na 90 %.

## 7. Hosting na `maciii.github.io/TureckoCup/` bez vlastní domény

**Proč.** Změna originu později by všem zrušila instalaci PWA, přihlášení
i offline cache. Vlastní doména až po turnaji.

## 8. Firebase chunk je předcachovaný

**Proč.** V Golfgames je Firebase nepovinná, tady je celá datová vrstva.
Studený start bez signálu (iOS zabije PWA kvůli foťáku) by jinak skončil
prázdnou obrazovkou.

## 9. Hash navigace místo pushState snímků

**Proč.** Service worker `autoUpdate` může aplikaci znovu načíst uprostřed
zápisu; hash drží obrazovku a odkaz na kolo jde poslat.

## Otevřené otázky

- Hlavní hra kola a její bodování (do rozhodnutí je týmové skóre jen Team
  Skins, označené jako předběžné).
- Extra body: model i rules je nesou, UI ani hry je nevyhodnocují.
- Log úprav (`edits`) se zapisuje, v UI se zatím nečte.
- Testy rules v emulátoru běží jen lokálně.
