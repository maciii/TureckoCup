# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Patch verzi zvedá `scripts/bump-version.mjs` při každém lokálním buildu.

## [0.34.1] – 2026-10-13

### Změněno

- **Rozpis zápasu brutto bez sloupců „brutto“:** opakovaly jen zapsanou ránu.
  Vítěze jamky teď nese podbarvená rána (u dvojic jejich lepší míč). Sloupec
  hodnoty strany zůstává jen u netto a bodů, kde se od rány liší.

## [0.34.0] – 2026-10-13

### Přidáno

- **Detaily na klepnutí u všech her** (kolo, přehled, karta živého kola,
  zápis):
  - **Zápas** (singly pozic, Four-ball, Texas, Best + Součet, Four-ball Skins):
    rozpis po jamkách - rány všech hráčů s tečkami ran z HCP, hodnota strany,
    se kterou zápas počítá (netto/brutto lepší míč, body), vítěz jamky
    v barvě týmu a průběžný stav (UP, rozdíl ran, body, skiny).
  - **Stableford a Skins:** řádek hráče otevře jeho jamky - rány, netto,
    body, u skinů vzatý skin s bankem, jinak kdo jamku vzal nebo dělená.
  - **Extra body:** hráč po jamkách - co, za kolik a proč se nepočítá.
  - **Team Skins kola:** rozpis jamek jako u zájezdu, s rozbalením na rány
    všech osmi.
  - **Přehled:** týmové skóre po kolech a hrách; jednotlivec po kolech
    (Stableford, skiny, extra s proklikem na rozpis kola); bilance pozice
    po kolech s proklikem na rozpis zápasu.
- `DuelResult.holeValues`: hodnota obou stran na jamce pro rozpis zápasu.

## [0.33.0] – 2026-10-13

### Přidáno

- **Team Skins zájezdu - rozpis jamky:** klepnutím se jamka rozbalí na rány
  všech osmi po týmech (v týmu od nejlepší), u netto i výpočet brutto − rány
  z HCP. Nejlepší rána týmu je orámovaná, u týmu, který skin vzal, v barvě
  týmu.

## [0.32.2] – 2026-10-13

### Změněno

- **Scorekarta u Texas scramble:** jeden řádek na dvojici (jména obou pod
  sebou, HCP dvojice, rána dvojice = nejlepší zapsaná, × když obě zvedly),
  součty a netto za dvojici, extra body obou partnerů v buňce dvojice.

## [0.32.1] – 2026-10-13

### Přidáno

- **Scorekarta druhého flightu:** detail druhého flightu ze zápisu (klepnutí
  na kartu „Flight 2 · … jamka“) ukazuje i jeho scorekartu s aktuální jamkou.

## [0.32.0] – 2026-10-13

### Přidáno

- **Odznaky v uvítání:** hráč vidí odznaky, které drží, s proklikem na detail
  (tabulka, u Skinaře rozpis).
- **Sběrač odznaků** (kdo drží nejvíc odznaků) a **Ani piču** (kdo nedrží
  žádný; točící se kosočtverec, při klepnutí zvuk).

### Změněno

- **Uvítání podle hry dne:** Rány na soupeře jen tam, kde hlavní zápas dne
  počítá s HCP (brutto ne, jamkovka podle Netto); u Texas scramble porovná
  HCP dvojice proti dvojici. Allowance náhledu bere hlavní zápas kola.
  Pravidlo „hra počítá s HCP“ je sdílené s editorem hry (`model/games.ts`).

## [0.31.0] – 2026-10-12

### Změněno

- **Odznak Skinař se počítá jednotně a má rozpis.** Skiny jednotlivců ve
  flightu netto (plný HCP, dělená jamka přenáší) ve všech odehraných kolech,
  i kde se Skins nehrály - dřív jen z kol se hrou Skins, každé s jiným
  nastavením. Detail odznaku vysvětluje pravidlo a pod tabulkou má rozpis
  netto i brutto: součty hráčů a po kolech a flightech jamky - kdo skin vzal
  (barva týmu, jeho rána proti nejlepší ráně ostatních, skiny i s bankem),
  dělené jamky tlumeně; vlastní skiny přihlášeného hráče zlatě orámované.

## [0.30.0] – 2026-10-12

### Přidáno

- **Team Skins zájezdu** na úvodní obrazovce: Team Skins přes všechna
  odehraná kola, netto i brutto vedle sebe (lepší míč týmu na jamce přes
  všech osm, dělená přenáší, plný HCP), nezávisle na tom, jak byla hra
  v kolech nastavená. Klepnutím rozpis po kolech a jamkách: vítězná jamka
  zvýrazněná barvou týmu se jménem hráče, rány obou týmů a počet skinů
  i s bankem; dělené jamky tlumeně s bankem. Přepínač Netto / Brutto.

## [0.29.1] – 2026-10-12

### Změněno

- **Editor hry schovává volby, se kterými výpočet nepočítá.** Allowance
  a u Texasu podíly HCP a HCP dvojic jsou vidět jen u netto hry: u formátu
  Brutto rány nikdy, u Jamkovky jen se zapnutým Netto, u ostatních her podle
  přepínače Netto. Body za výhru, remízu a za skin jsou vidět jen u hry,
  která se počítá do týmového skóre. Uložené hodnoty zůstávají, po přepnutí
  se vrátí.

## [0.29.0] – 2026-10-12

### Přidáno

- **Nová hra Texas scramble dvojic.** Dvojice z flightu hraje jeden míč
  z lepší rány a má na jamku jedno skóre; hraje proti dvojici druhého týmu
  ve flightu. Hrací HCP dvojice je 35 % nižšího + 15 % vyššího hracího HCP
  partnerů (doporučení WHS), podíly jdou v editoru hry změnit a editor
  ukáže HCP všech dvojic. Formát jamkovka (výchozí, s dormie), netto/brutto
  rány nebo Stableford; body do týmu za výhru a remízu.
- Zápis Texasu: jeden řádek za dvojici, klepnutí uloží skóre oběma
  partnerům, tečky ukazují rány dvojice, nahoře karta zápasu se stavem.
- Testovací verze: den 5 hraje Texas scramble dvojic.

## [0.28.3] – 2026-10-12

### Přidáno

- **Dormie v jamkovce** jako v Golfgames: když má vedoucí náskok rovný
  počtu jamek, které zbývají, ukáže hlavička zápasu „Mac 2 UP · dormie“
  s červeným prstencem a pod ní „dormie · zbývají 2 jamky“. Stejně
  v řádcích duelů (přehled, druhý flight, výsledky kola) a ve stavu her.
  Platí pro singly pozic i Four-ball hrané jamkovkou.

## [0.28.2] – 2026-10-12

### Opraveno

- **Druhý flight ukazuje stav singlů pozic.** Karta pod zápisem i detail
  druhého flightu (klepnutím na kartu) ukazovaly jen hry dvojic; teď mají
  i singly pozic, jejichž oba hráči v tom flightu hrají, se stavem zápasu
  (např. „Mac 2 UP“).

## [0.28.1] – 2026-10-11

### Opraveno

- E2E menu: po přihlášení z menu se nejdřív odklepne uvítání dne.

## [0.28.0] – 2026-10-11

### Přidáno

- **Osobní uvítání hráče.** Přihlášený hráč vidí po otevření aplikace jednou
  denně celoobrazovkové přivítání a na úvodní obrazovce kartu: co dnes
  hraje (kolo, hřiště, flight, tee time, spoluhráči, hry) a jeho zápas
  (single pozic nebo dvojice proti dvojici), tlačítko **Rány na soupeře**
  a **Zapsat skóre** rovnou do vlastního flightu.
- **Rány na soupeře** - náhled scorekarty před zápasem: u všech 18 jamek
  (par, SI), proti každému z flightu, kde má hráč ránu navíc (zeleně +1) a
  kde ji má soupeř na něj (červeně −1); soupeř ze zápasu první, parťák
  poslední, dole součet jamek. Počítá se z přidělených ran kola (hrací HCP
  × allowance hry singlů), tedy stejně jako netto hry.
- **Rozsah zápisu u singlů ve flightu:** „Jen můj zápas“ (druhý single
  zůstane sbalený na hlavičku se stavem, rozbalí se klepnutím) nebo „Celý
  flight“. Volba je při vstupu z uvítání i přepínačem v zápisu a pamatuje
  se na zařízení.
- **Nenažranec** má na medaili jehně otáčející se na rožni nad ohněm a při
  klepnutí žalostně zabečí (zvuk syntetizovaný v telefonu, bez stahování).

## [0.27.1] – 2026-10-11

### Opraveno

- E2E proti emulátorům čtou zápis celého flightu, ne prvního řádku - pořadí
  řádků v zápisu se řídí hrami kola.

## [0.27.0] – 2026-10-11

### Změněno

- **Zápis seskupený po duelech.** Když se singly pozic hrají uvnitř flightu,
  stojí soupeři pod sebou v jedné kartě s hlavičkou zápasu: tým A vlevo,
  tým B vpravo, uprostřed stav v barvě vedoucího týmu („Vrbič 1 UP“,
  u součtových formátů i průběžné součty obou stran) a komu připadla
  právě zapisovaná jamka. Řádky hráčů mají proužek v barvě týmu. Řádek
  „Singly pozic“ ve stavu her nahoře se pak neopakuje.

## [0.26.1] – 2026-10-10

### Změněno

- **Odznaky jako medaile ve stylu Apple Fitness.** Broušený zlatý okraj
  s tloušťkou hrany, smaltovaný střed v barvě odznaku s raženým znakem
  (ptáček, orel, plamen, míček, stehno; jinak text). Získané medaile se
  pomalu otáčejí kolem své osy a ukazují rub se jménem držitele, počtem
  a datem; nezískané stojí šedé. Gratulace: medaile přiletí z dálky
  s trojitou otočkou, kolem vystřelí jiskry a padá konfeta.

## [0.26.0] – 2026-10-10

### Přidáno

- **Odznaky zájezdu** na úvodní obrazovce: individuální statistiky ze všech
  dohraných a rozehraných kol jako plastické medaile ve stylu Apple awards -
  STBák zájezdu (nejvíc STB bodů), Birdie Man, Orel, Parista, Žhavá série
  (nejdelší řada jamek na par a lépe), Skinař, Dlouhán (Longest), Ostrostřelec
  (Nearest), Bogie Man, 2 Bogie Man, 3 Bogie Man, Nenažranec (čtyřbogey a hůř,
  zvednutá jamka se počítá) a No Stable Man (jamky bez STB bodu). Medaile nese
  jméno držitele a počet, při shodě jsou držitelé všichni.
- Klepnutí na odznak otevře tabulku všech osmi hráčů v dané statistice
  s pořadím a zvýrazněným přihlášeným hráčem.
- Přihlášený hráč, který odznak drží, dostane po otevření aplikace gratulaci
  s animací (konfety, točící se medaile); každý odznak ukáže jednou a znovu
  až když ho získá nebo mu změní hodnota. Návštěvník bez přihlášení gratulaci
  nevidí.

## [0.25.5] – 2026-10-10

### Opraveno

- E2E test proti emulátorům hledá neodeslané zápisy v odznaku v hlavičce.

## [0.25.4] – 2026-10-10

### Změněno

- **Zápis skóre neposkakuje.** Hláška o neodeslaných zápisech už není řádek
  nad hráči, který se objevoval a mizel, ale malý odznak v hlavičce zápisu.

## [0.25.3] – 2026-10-10

### Opraveno

- **Four-ball Skins po oponentuře:** právo dublovat „prohrávající“ se bere ze
  skóre zápasu včetně bodů za birdie; jamky za první nezapsanou čekají, aby se
  bank a Double zpětně neměnily; u volby „kdokoli“ platí Double obou dvojic
  (×4); hláška „nesměl dublovat“ jen když dvojice dublovat opravdu nesměla;
  vypnutí Double u obou partnerů; karta zápasu jen na jamkách hry; řádek
  zápasu ukáže i skóre jen z birdie.
- Individuální Skins ve flightu berou výsledek jamky jen ze své skupiny.
- Soubor CHANGELOG.md byl od verze 0.25.3 omylem prázdný; obnoven.

## [0.25.2] – 2026-10-10

### Opraveno

- **Four-ball Skins: karta zápasu ukazovala „bere 0“** nebo cizí bank. Četla
  výsledek jamky ze seznamu obou zápasů kola a při stejném čísle jamky mohla
  chytit jamku druhého flightu. Skiny a bank jamky jsou teď součástí dat
  zápasu a karta čte jen je.
- E2E testy, které hlídají, že se čtyři hráči vejdou na displej, počítají
  s kartou druhého flightu pod nimi.

## [0.25.1] – 2026-10-10

### Změněno

- Karta druhého flightu je v zápisu až úplně dole pod hráči, aby neodsouvala
  zadávání ran.

## [0.25.0] – 2026-10-10

### Přidáno

- Four-ball Skins: přepínač **Bod navíc za každé birdie** - za každé birdie
  a lepší kteréhokoli partnera (brutto) dostane dvojice bod do skóre zápasu
  navíc ke skinům. Karta zápasu ukáže „Birdie +1“. Live admin úloha `birdie`
  ho zapne u dnešní hry; testovací verze dny 4 a 5.

## [0.24.2] – 2026-10-10

### Změněno

- **Stav druhého flightu v zápisu výrazně.** Místo štítku je nad stavem her
  karta druhého flightu: na které jamce je a stav jeho zápasů (Four-ball,
  Best + Součet, Four-ball Skins) jako řádek s dvojicemi a skóre. Klepnutí
  otevře náhled flightu jako dřív.

## [0.24.1] – 2026-10-10

### Opraveno

- E2E test programu kola nezávisí na skutečném datu (po půlnoci selhával v CI).

## [0.24.0] – 2026-10-09

### Změněno

- **Dvojice plynou z flightů.** Dva hráči téhož týmu ve flightu jsou
  dvojice, flight je jeden zápas A proti B; u Four-ballu, Best + Součet
  a Four-ball Skins se už nic nenastavuje. U každého flightu v editoru
  kola je řádek Dvojice, flight bez dvou a dvou hráčů dostane varování,
  karta hry zápasy jen shrne. Pořadí hráčů v zápisu je tým A, pak tým B.
- „Dubl“ se všude jmenuje **Double**.

## [0.23.0] – 2026-10-09

### Přidáno

- **Four-ball Skins** - nová hra: dvojice proti dvojici, lepší míč (netto
  nebo brutto), skin za jamku, dělená jamka přenáší; dvojice s víc skiny
  bere po dohrání bod do týmu, remíza 0,5, za každý zápas zvlášť. Dvojitá
  9 a 18 a extra body do hry jako u ostatních her. **Double**: oprávněná
  dvojice (nastavitelné: prohrávající, kdo ztratil jamku, kdokoli, nikdo)
  hraje jamku o dva skiny; zapíná se tlačítkem v kartě zápasu, kdykoli,
  ukládá se jako surová data s logem úprav. Testovací verze dny 4 a 5.

## [0.22.0] – 2026-10-09

### Přidáno

- **Longest a Nearest u kola** (Admin → kolo → Longest a Nearest), jako
  v Golfgames: pro každý z nich, jestli se v kole hraje a čím se potvrzuje -
  bez potvrzení, brutto par, nebo netto par (par + rány z HCP na jamce).
  Výchozí je z Pravidel turnaje; tam přibyl přepínač „Nearest se potvrzuje
  osobním parem“. Vyhodnocení i panel extra bodů berou nastavení kola.

## [0.21.1] – 2026-10-09

### Opraveno

- **Nepotvrzený Longest/Nearest jde soupeřům.** Když držitel jamku nezahraje
  na par (nebo zvedne), dostane bod druhá dvojice v Best + Součet, v jiné
  týmové hře s extra body druhý tým. Ve vedlejší sázce jednotlivců soupeř
  není, tam bod dál jen propadá. Dva držitelé dál nedávají nic nikomu.
  Panel stavu jamky ukáže „Honza L✗ soupeři +1“.

## [0.21.0] – 2026-10-09

### Přidáno

- **Dvojité body na 9. a 18. jamce** - volba u hry (Stableford, Skins,
  Team Skins, Best + Součet): na devítce a osmnáctce se násobí dvěma
  Stablefordové body, hodnota skinu (dělená jamka přenáší dva) a všechny
  body dvojice v Best + Součet. Karta dvojic v zápisu ukáže chip ×2.
  Testovací verze den 3; Live admin úloha `double` ji zapne u her živého kola.

## [0.20.4] – 2026-10-09

### Změněno

- Best + Součet: vyhraná hodnota v kartě dvojic (Best, Součet, Birdie,
  Double, Extra) má červené pozadí místo zlatého - zlatá byla na podkladu
  špatně vidět.

## [0.20.3] – 2026-10-09

### Opraveno

- **Hráči v zápisu a ve scorekartě jdou podle dvojic ze hry.** U Four-ballu
  a Best + Součet jsou partneři pod sebou v pořadí stran, jak je admin
  nastavil (Mac + Honza, Ferry + Soldík), ne v pořadí flightu; stejně
  panel stavu jamky, panel extra bodů a karta živého kola.

## [0.20.2] – 2026-10-09

### Opraveno

- **Longest a Nearest jdou zaškrtnout na kterékoli jamce.** Dřív se Longest
  nabízel jen na par 5 a Nearest jen na par 3, takže na hřišti začínajícím
  parem 4 (Lykia Links, den Best + Součet) v panelu extra bodů chyběly.
  Kde se hrají, rozhodne flight; na jamce je má dál jen jeden hráč.

## [0.20.1] – 2026-10-08

### Opraveno

- **„Promítnout soupisku do plánovaných kol“ už nepřepisuje flighty ani
  pozice.** Složení flightů a pozice jsou nastavení každého kola; soupiska
  do kol zapisuje jen HCP indexy a změnu týmu (pozice se z ní berou jen
  tehdy). Varování nad seznamem kol se podle flightů a pořadí pozic
  neukazuje.

## [0.20.0] – 2026-10-08

### Přidáno

- **Karta živého kola na úvodní obrazovce.** Jakmile kolo běží, hned pod
  hlavičkou je, na které jamce oba flighty jsou, stav všech zápasů kola
  (Four-ball, Best + Součet, singly pozic) a pro přihlášeného hráče nebo
  admina tlačítko **Zapsat skóre**, které otevře rovnou jeho flight na
  aktuální jamce. Návštěvník tam má přihlášení Googlem.
- Program kola (odjezd, tee time) zůstává pod kartou jen do prvního zápisu;
  pak ukazuje další kolo.

## [0.19.0] – 2026-10-08

### Přidáno

- Best + Součet: volitelný **Double Best** (bodů za jamku, 0 = nehraje se):
  bod navíc, když oba míče dvojice porazí oba míče soupeře.

## [0.18.0] – 2026-10-08

### Změněno

- **Extra body do týmového skóre se zapínají u hry, ne u kola.** U každé
  týmové hry je přepínač „Extra body do této hry“: Best + Součet je přičte
  k bodům dvojice na jamce (jako Golfgames), ostatní týmové hry k bodům
  týmu z té hry sazbou z Pravidel turnaje. Přepínač u kola zmizel, tabulka
  extra bodů kola už týmové body sama nedává.

## [0.17.3] – 2026-10-08

### Změněno

- „Duely pozic“ se jmenují **Singly pozic**: jeden na jednoho, A1 proti B1
  až A4 proti B4. Jamkovka dvojic je Four-ball.

## [0.17.2] – 2026-10-08

### Opraveno

- Desetinná čísla v administraci (body za výhru a remízu, bod za skin,
  hodnoty a násobiče extra bodů, pravidlo zvednuté jamky) jdou zadat
  s čárkou i tečkou; dřív pole rozepsané „0,“ hned srazilo na 0.

## [0.17.1] – 2026-10-08

### Změněno

- Editor hry: Best + Součet nemá záložky formátu duelu (má vlastní
  bodování). U duelů a Four-ballu se přepínač Netto ukáže jen u Jamkovky,
  Rány a Stableford mají netto/brutto ve formátu; pod záložkami je nápověda.
  Přepnutí druhu hry na týmovou hru zapne body týmu (1 / 0,5).

## [0.17.0] – 2026-10-08

### Přidáno

- **Hra Best + Součet** (vzor Golfgames): dvojice proti dvojici, na každé
  jamce bod za lepší míč, bod za součet, 1 za birdie a 3 za eagle partnerů.
  V zápisu je karta dvojic s Best, Součtem a body na jamce a průběžným
  skóre zápasu; výsledky kola ukazují zápasy jako u Four-ballu. Testovací
  verze ji má ve dni 3.

## [0.16.1] – 2026-10-08

### Opraveno

- **Aktualizace se používá sama**, jen ne uprostřed zápisu: na obrazovce
  zápisu počká, až z ní zapisovatel odejde, jinde se stránka obnoví hned.
  Otevřená aplikace novou verzi hledá každých 10 minut a po návratu na
  popředí (dřív jen při spuštění, takže dlouho otevřená aplikace zůstala
  na staré verzi).
- **Hranice chyb**: výjimka v obrazovce už nenechá bílou obrazovku
  (vypadala jako pád). Ukáže se hláška s tlačítkem Pokračovat, chyba se
  uloží a menu ji ukazuje dole jako „Poslední chyba“, ať jde nahlásit.

## [0.16.0] – 2026-10-08

### Přidáno

- U každého kola přepínač **Extra body do týmového skóre** (Admin → kolo,
  nad hrami; výchozí zapnuto). Sazba za bod zůstává centrálně v Pravidlech
  turnaje; vypnuté kolo nechá extra body jen jako vedlejší sázku jednotlivců.

## [0.15.6] – 2026-10-08

### Změněno

- Na poslední jamce flightu je místo neaktivního „Další jamka“ tlačítko
  **Ukončit hru**, které otevře vyhodnocení kola.

## [0.15.5] – 2026-10-08

### Opraveno

- **Aplikace se už neobnovuje sama** po nasazení nové verze (vypadalo to
  jako pád po návratu do aplikace uprostřed zápisu). Nová verze čeká:
  v menu je tlačítko „Obnovit aplikaci“, jinak se použije při příštím
  spuštění.

## [0.15.3] – 2026-10-08

### Opraveno

- Jamkovka (Four-ball, duely pozic) respektuje přepínač **Netto** hry:
  vypnutý počítá brutto lepší míč. Dřív jamkovka počítala vždy netto bez
  ohledu na přepínač, takže nastavení kola a výsledek nesouhlasily.

## [0.15.2] – 2026-10-08

### Opraveno

- Stav her na jamce: Four-ball a duely pozic ukazují, kdo jamku bere nebo
  že je dělená (dřív pořád „čeká na zápis“), Stableford ukazuje body za
  jamku místo průběžných součtů. Duely nesou výsledek po jamkách
  (`holeWinners`).

## [0.15.1] – 2026-10-08

### Opraveno

- Zápis buňky, který pravidla odmítnou, klient po 1,5 s zopakuje a teprve
  druhé odmítnutí hlásí; hláška radí zkusit znovu nebo se přihlásit znovu.
  Odmítnutí bývá přechodné (kolo právě přepnuté, oprávnění právě uložené).
- Pravidla snesou kolo bez mapy extra bodů (založené před extra body).
- Live admin: úloha `bonuses` doplní prázdné mapy extra bodů do kol.

## [0.15.0] – 2026-10-08

### Změněno

- **Extra body hvězdičkou v řádku hráče** v zápisu (jako v Golfgames):
  druhý řádek hráče je tlačítko ★, otevře panel pro toho hráče. Tlačítko
  u jamky zmizelo.
- **Stav her v záhlaví jamky**: u každé hry kola, co na téhle jamce
  spočítala (skin, dělená jamka a bank, body, duel) a průběžný stav
  (pořadí, skiny, týmové skóre, stav duelů, extra body).
- **Změny extra bodů jdou do logu úprav** kola stejně jako rány: kdo, kdy,
  komu a z čeho na co. Log v administraci je ukazuje značkami (★ – → L S).
- Menu má sekci **Návody** s odkazem na návod pro hráče a (pro admina)
  příručku admina.

## [0.14.0] – 2026-10-08

### Změněno

- **Menu podle role.** Nepřihlášený má hned pod názvem turnaje tlačítko
  „Přihlásit se Googlem“ a nápovědu, přihlášený hráč vidí své jméno s rolí
  a dole „Odhlásit se“. Položka **Admin** je jen pro administrátora.
  Obrazovka s účtem zůstává na adrese `#/admin` pod názvem „Účet“.
- Zápis bez přihlášení nabídne tlačítko přihlášení přímo v hlášce místo
  odkazu na menu Admin. V ukázkovém režimu přihlášení dělá z návštěvníka
  hráče (admina přepne ukázková identita).

## [0.13.0] – 2026-10-08

### Změněno

- **Ikona a barvy podle erbu turnaje** (`design/crest.png`): PWA ikony,
  ikona na ploše iPhonu a favicon nesou erb na námořnické modři; hlavička
  aplikace je námořnická se zlatou linkou, odkazy, zvolené záložky a hlavní
  tlačítka jsou v modři erbu, zlatá týmu Achiles je zlatá erbu. Erb je na
  úvodní obrazovce a v menu. Ikony generuje `scripts/gen-icons.py`.
- **Google účet bez ověřeného e-mailu** (typicky adresa seznam.cz u Google
  účtu) pravidla pustí: Google adresu ověřuje při založení účtu, Firebase
  u cizích domén příznak nenastaví. Jiné přihlášení aplikace nenabízí.

## [0.12.0] – 2026-10-08

### Přidáno

- **Karta programu na úvodní obrazovce je vždy vidět** pro kolo, které je na
  řadě: dnes rozehrané, jinak nejbližší plánované. Odehrané kolo (všichni
  zapsali všechny jamky) i rozehrané kolo z minulého dne ustoupí dalšímu
  dni. Bez zadaných časů karta ukáže, že odjezd a tee time doplní admin.
- Neověřený Google e-mail dostane při přihlášení vlastní hlášku místo
  „není mezi hráči“ - rules ho nepustí, i když v soupisce je.
- Workflow Live admin: `check` vypíše i e-maily hráčů a účty, které se
  zkusily přihlásit (ověření e-mailu, zda jsou v soupisce), a program kol;
  nová úloha `schedule` doplní chybějící odjezd a tee time podle seedu.

## [0.11.1] – 2026-10-08

### Opraveno

- Admin hlásil „plánovaná kola mají starší HCP, týmy nebo pozice než
  soupiska“ i po klepnutí na „Promítnout soupisku“: Firestore vrací klíče
  mapy pozic v libovolném pořadí a porovnání snímku bralo `{B, A}` jako jiný
  obsah než `{A, B}`. Pozice se teď porovnávají po týmech.

## [0.11.0] – 2026-10-08

### Změněno

- **Extra body jsou obecné, ne samostatná hra** (jako v Golfgames): hodnoty
  a pravidla se nastaví jednou v Admin → Pravidla turnaje a platí v každém
  kole a vedle každé hry. Výchozí hodnoty podle Golfgames: longest, nearest,
  sandie, water, barkie, arnie po 1 bodu; birdie a eagle (z ran) vypnuté.
  Longest a Nearest platí jen při paru a lepším (Longest osobním parem),
  ostatní bonusy platí za par a při birdie/eagle se násobí (×2, ×3), při
  bogey propadají. Volitelně týmové body za extra bod.
- Scorekarta má sloupec **Extra** se součtem extra bodů hráče a značky
  u ran ukazují, které bonusy se počítají (přeškrtnuté se nepočítají).
  Výsledky kola mají tabulku Extra body, přehled turnaje sčítá extra body
  jednotlivců.
- Hra „Extra body“ z nastavení kola zmizela; dřív zapsané bonusy zůstávají.

### Přidáno

- Workflow **Live admin** (`scripts/live-admin.mjs`): údržba živých dat
  servisním účtem s rolí Cloud Datastore User - kontrola, odpaliště podle
  seedu, odstranění staré hry Extra body, HCP indexy do nedohraných kol.

## [0.10.0] – 2026-10-08

### Změněno

- **Extra body jsou výchozí hra každého kola** (jako v Golfgames): longest,
  nearest, birdie a eagle zapnuté od začátku, zapisovatel vidí hvězdičku
  u jména hráče hned. U už založených kol ji admin přidá tlačítkem
  „+ Přidat hru“ a výběrem „Extra body“.
- **HCP index se do nedohraných kol srovná sám** při otevření adminu -
  žádné klepání.
- „Promítnout soupisku do plánovaných kol“ zároveň srovná duplicitní
  pozice 1–4 v soupisce (podle pořadí hráčů).

## [0.9.1] – 2026-10-07

### Změněno

- **HCP index se nastavuje jen u hráče.** Kola, která nejsou dohraná, ho
  dostanou hned; index změněný v tabulce Hrací HCP u kola se zapíše i hráči
  a do dalších nedohraných kol. Dohraná kola si nechají svůj snímek.
  Tlačítko „Promítnout soupisku“ zůstává pro změnu týmu nebo pozice.

## [0.9.0] – 2026-10-07

### Přidáno

- **Hrací handicap v Pravidlech turnaje**: „Podle hřiště (WHS)“ (výchozí),
  nebo **„Pevný po celý turnaj“** - hrací HCP je zaokrouhlený HCP index,
  stejný počet ran v každém kole bez ohledu na hřiště a odpaliště. Změna se
  hned promítne do všech nedohraných kol; ruční přepis u kola má přednost.
  Nastavení kola ukazuje, který režim platí.

## [0.8.2] – 2026-10-07

### Změněno

- Výchozí odpaliště všech kol jsou **žlutá** (Lykia Links žlutá nemá, tam
  zlatá, 5 791 m). Platí pro nově založený turnaj a „Obnovit konfiguraci
  kola ze seedu“; u už založených kol odpaliště přepne admin u kola.

## [0.8.1] – 2026-10-07

### Přidáno

- **Promítnout soupisku do plánovaných kol** (Admin → Kola): když se změní
  HCP index, tým nebo pozice hráče, kola založená dřív to sama nedostanou
  (nesou si snímek). Admin teď vidí upozornění, kolik plánovaných kol má
  starší soupisku, a jedním klepnutím do nich promítne HCP indexy, pozice
  a složení flightů. Odpaliště, hry, časy, ruční HCP i rozehraná kola
  zůstanou - na rozdíl od „Obnovit konfiguraci kola ze seedu“.

## [0.8.0] – 2026-10-07

### Přidáno

- **Pravidla turnaje** (Admin): centrální nastavení, kolik ran se počítá za
  zvednutou jamku ve hře na rány (duely pozic a four-ball na brutto/netto
  rány). Presety netto dvojbogey (výchozí), 2× par, 2× par + 2, nebo vlastní
  násobek paru + rány navíc (+ rány z handicapu).
- **Four-ball** je v nastavení kola pod svým jménem (dřív „Týmový zápas“)
  a má editor dvojic: pro každý zápas čtyři výběry hráčů, tlačítko „Dvojice
  z flightů“ vrátí A1+A2 vs B1+B2 a A3+A4 vs B3+B4.
- **Extra body** (podle Golfgames): nová hra „Extra body“ s hodnotou každého
  bonusu - Longest (par 5), Nearest (par 3), birdie a eagle (automaticky
  z ran), sandie, water, barkie, arnie - a volbou „platí jen při paru
  a lepším“. Zapisovatel bonusy zaškrtne tlačítkem u jména hráče v zápisu,
  značky jsou u jména i ve scorekartě, výsledky mají vlastní tabulku
  s rozpisem a mohou se počítat do týmového skóre. Longest a Nearest drží
  na jamce jediný hráč.
- Testovací verze: Extra body v 1. kole a do týmu ve 4. kole, zvednutá
  jamka = 2× par.

### Změněno

- Zápis bonusu je ve Firestoru stejná „jedna buňka“ jako skóre
  (`bonuses.hráč.jamka` + `lastEdit`), pravidla ho pouštějí zapisovatelům
  a test rules to hlídá.

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
