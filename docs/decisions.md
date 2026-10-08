# Rozhodnutí a jejich důvody

Formát: kontext → rozhodnutí → důsledek. Rozhodnutí převzatá z Golfgames
(PWA, Spark, tmavé a světlé schéma, zápis par doprostřed, testuje se
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

## 5. Přihlášení jen pro hráče a admina, e-mail u každého hráče

**Rozhodnutí (verze 0.5.0).** `private/access.playerEmails` přiřazuje každému
hráči jeho Google e-mail. Přihlásit se a zapisovat smí jen hráč s e-mailem
v soupisce nebo admin; cizí účet aplikace odhlásí a rules ho nepustí.
Anonymní přihlášení (uid) bylo zrušeno. Hráč smí zapsat kteréhokoli hráče
(markér flightu zapisuje za všechny). Bootstrap admin je napevno v rules
kvůli prvnímu založení.

**Proč.** Admin chce hned poznat, kdo je přihlášený a kdo co zapsal. Hráči
dokument s e-maily číst smějí (8 kamarádů se zná), visitor ne. Firebase
nemůže přihlášení cizím účtem zakázat bez placených funkcí, proto ho klient
po přihlášení odhlásí.

## 6. Snímky v kole: index, odpaliště, pozice

**Rozhodnutí.** Kolo si nese `playerIndex`, `playerTees`, `positions` a
`courseHandicapOverride`; allowance se aplikuje ve hře.

**Proč.** Změna indexu nebo pozice třetí den nesmí přepočítat odehraná kola.
Allowance per hra, aby stejné kolo mohlo mít Skins na 100 % a zápas na 90 %.

## 7. Hosting na Firebase (`turecko-cup.web.app`) bez vlastní domény

**Kontext.** GitHub Pages zdarma jen pro veřejné repozitáře. Veřejný kód by
ukázal e-maily adminů a soupisku hráčů.

**Rozhodnutí.** Firebase Hosting na plánu Spark: zdarma, repozitář zůstává
soukromý, doménu Firebase sám autorizuje pro přihlášení a na stejné doméně
běží i přihlašovací stránka (`/__/auth/handler`) - to umožní spolehlivější
přihlášení na iPhonu, když se `authDomain` přepne na `web.app`.

**Proč bez vlastní domény.** Změna originu později by všem zrušila instalaci
PWA, přihlášení i offline cache. Vlastní doména až po turnaji.

## 8. Firebase chunk je předcachovaný

**Proč.** V Golfgames je Firebase nepovinná, tady je celá datová vrstva.
Studený start bez signálu (iOS zabije PWA kvůli foťáku) by jinak skončil
prázdnou obrazovkou.

## 9. Design systém ze Zavařovák Cupu, jen světlé schéma

**Kontext.** Uživatel dodal aplikaci Zavařovák Cup (Ryder Cup formát, Next.js)
jako vzor designu. Její systém: světlý tichý podklad, Inter na všechno,
barva jako signál (živý stav, primární akce, tým), seznamy s tenkými děliči
místo karet, skóre v barevných pilulkách, nadpisy sekcí s barevným proužkem.

**Rozhodnutí.** Převzít tokeny a gramatiku Zavařováku (`src/styles.css`),
týmy A/B jako žlutá a námořnická modrá, značky skóre podle golfové konvence
(kolečko pod par červeně, zlatě eagle; čtverec nad par modře). Tmavé schéma
z Golfgames zrušeno - Zavařovák ho záměrně nemá a za slunce se světlé čte líp.
Interakce zápisu (par doprostřed, −/+, přidržení = smazat, velké cíle) zůstává
z Golfgames.

**Důsledek.** Inter se nese v bundlu (`@fontsource-variable/inter`, latin
a latin-ext), aby fungoval offline. Scorekarta je horizontální po devítkách.

## 10. Hash navigace místo pushState snímků

**Proč.** Service worker `autoUpdate` může aplikaci znovu načíst uprostřed
zápisu; hash drží obrazovku a odkaz na kolo jde poslat.

## 11. Log úprav čte jen admin

**Proč.** Záznam nese e-mail zapisovatele (aby admin věděl, kdo co opravil).
E-maily jinak leží jen v `private/access`; veřejně čitelný log by je
prozradil komukoli. Visitor log nepotřebuje, výsledky se počítají ze skóre.

## 12. E2E na skutečném WebKitu v CI

**Proč.** Na hřišti se zapisuje z iPhonů. Safari se od Chromia liší
v dotyku, vyskakovacích oknech i layoutu, proto iOS profily běží v CI ve
WebKitu. Vývojový kontejner WebKit nemá, tam běží stejné profily v Chromiu.
Nasazení čeká na e2e i testy rules.

## 13. Kontrola dat před zápisem v obou adapterech

**Proč.** Editor pozic posílal pole s dírou; localStorage ho přijal,
Firestore by ho odmítl až na hřišti. `findInvalidWrite()` teď stejné chyby
zachytí v ukázkovém režimu a e2e testech dřív, než se dostanou do produkce.

## 14. E2E proti emulátorům Firebase

**Proč.** Chyba s pozicemi se projevila jen ve Firestore adapteru, ukázkový
režim ji nezachytil. Test `e2e-firebase` pouští produkční datovou vrstvu
proti emulátorům s ostrými rules. Projekt `demo-tc26` emulátory nikdy
nepustí na skutečný Firebase. Napojení na emulátory i háček pro přihlášení
existují jen ve vývojovém serveru.

Playwright WebKit na Linuxu (síťová vrstva libsoup) neudrží streamovací kanál
Firestoru: požadavky WebChannel končí „WebKit encountered an internal error“.
Skutečné Safari na iPhonu má jinou síťovou vrstvu a SDK si v produkci samo
přepne na long polling, když streamování selže. Test iOS profilu proti
emulátorům proto běží přes long polling na vlastním dev serveru; Android
testuje výchozí přenos. Živou synchronizaci na skutečném iPhonu ověří zkouška
nanečisto (`setup-firebase.md`, krok 7).

## 15. Testovací verze jako varianta ukázkového režimu

**Kontext.** Admin si chce před turnajem ověřit, jak bude aplikace vypadat
po několika dnech a jak se chovají různé hry, bez zápisů do ostré databáze.

**Rozhodnutí.** `?demo=4dny` spustí místní úložiště s vlastními klíči a daty
z generátoru (`preview.ts`) místo prázdného seedu. Generuje se jen raw skóre
a konfigurace kol, výsledky počítají stejné evaluace. Semínko je pevné, aby
dva lidé na stejném odkazu viděli stejná čísla; „Vylosovat nová data“ v menu
dá nová. Kvůli testovací verzi umí admin nově měnit i název hry a rozsah
jamek - jinak by v nastavení neviděl, čím se hry dne liší.

**Důsledek.** Žádná nová infrastruktura ani data ve Firestoru; testovací
verze funguje offline a na produkci bez přihlášení. Zápisy v ní zůstávají
jen v prohlížeči, proto ji odlišuje zlatý štítek „Test“ na každé obrazovce.

## 16. Vzhled podle erbu turnaje

**Kontext.** Turnaj má vlastní erb (pohár, české a turecké barvy, zlatý
lem, námořnická modř). Aplikace do té doby nesla zelenou z Golfgames.

**Rozhodnutí.** Předloha je `design/crest.png`, z ní `scripts/gen-icons.py`
dělá PWA ikony (erb na modři erbu, maskable ve zmenšené bezpečné zóně),
favicon a erb do aplikace. Paleta v `:root` je z erbu: `--brand` je
námořnická modř (hlavička, odkazy, zvolené záložky, hlavní tlačítka),
`--gold-bright` zlatá linka hlavičky, červená vlajek pro chyby a ztráty,
krémové pozadí. Zelená zůstává golfu: zisk, skin, par. Tým A má zlatou
erbu, tým B světlejší modř, aby se nepletl s ovládacími prvky.

**Důsledek.** Žádné `#hex` v komponentách, vše přes proměnné; status bar
na iPhonu zůstává systémový (`default`), námořnickou bere jen Android
z `theme-color`.

## 17. Google účet bez ověřeného e-mailu

**Kontext.** Hráč s Google účtem na adrese seznam.cz dostal po přihlášení
„není mezi hráči“, i když adresu v soupisce měl. Firebase u Google účtů
s cizí doménou nenastavuje `email_verified`, a rules ověření vyžadovaly.

**Rozhodnutí.** `verified()` v rules pustí i neověřený e-mail, pokud ho
přinesl poskytovatel `google.com` - Google adresu ověřuje při založení
účtu. Jiné přihlášení aplikace nenabízí, takže se nic jiného neotevírá.
Klient navíc rozliší hlášku pro neověřený e-mail od „není mezi hráči“.

## Otevřené otázky

- Hlavní hra kola a její bodování (do rozhodnutí je týmové skóre jen Team
  Skins, označené jako předběžné).
