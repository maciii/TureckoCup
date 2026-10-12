# Pravidla her

Jak aplikace vyhodnocuje jednotlivé hry. Každá hra kola je konfigurace
(`GameConfig`) a vyhodnocuje se nezávisle nad stejnými raw skóre - jde
přidat, změnit i smazat kdykoli, i po dohrání kola, a výsledek se přepočítá.

Společné pro všechny hry:

- Zapisuje se **brutto skóre** (počet ran). **Zvednutá jamka** je explicitní
  hodnota `0` (v UI tlačítko `×`); chybějící zápis znamená „ještě nezapsáno“.
- **Netto** = brutto minus rány podle hracího handicapu a stroke indexu.
  Hrací HCP = WHS z indexu a normy odpaliště hráče (`CR`, `SR`, par), nebo
  v pevném režimu turnaje (`handicapMode: 'fixed'`, Pravidla turnaje)
  zaokrouhlený index stejný ve všech kolech; ruční přepis administrátora
  má vždy přednost; hra ho může krátit (`allowance`).
  Hráč bez indexu hraje s nulou a UI to ukazuje otazníkem.
- **Jamka je rozhodnutá**, až když zapsali všichni, kterých se hra týká.
- Pořadí jamek je pořadí hraní flightu (start z jedničky nebo z desítky).

## Stableford (`individual-stableford`)

Každý sám za sebe. Netto par 2 body, birdie 3, eagle 4, bogey 1, dvojbogey a
horší 0. Zvednutá jamka 0 bodů. Počítá se průběžně po hráčích; při shodě bodů
rozhoduje nižší počet ran. Součet přes kola je v přehledu turnaje.

## Skins (`individual-skins`)

Každá jamka je jeden skin, bere ho hráč s nejnižší netto ránou. Při shodě se
skin nepřiděluje a přenáší do další jamky (`carry`, výchozí ano). Rozsah
(`scope`): v rámci **flightu** (výchozí, čtyři hráči) nebo přes všech osm.

- Jamka se rozhoduje, až zapíše celý flight (resp. všech osm).
- Kdo zvedl, o skin se ucházet nemůže; když zvedli všichni, je jamka dělená.
- Skiny přenesené z poslední jamky propadají.

## Team Skins (`team-skins`)

Team A proti Team B. Rána týmu na jamce je **nejlepší netto míč** ze všech
jeho hráčů z obou flightů. Jamka se rozhoduje, až zapsalo všech osm - flighty
hrají s odstupem a pozdější flight nesmí platit za vzdaný. Přenos banku jako
u Skins. `teamPoints.perSkin` (výchozí 1) říká, kolik týmových bodů skin nese;
hra má výchozí `countsForTeam: true`.

## Singly pozic (`position-duel`)

V aplikaci „Singly pozic“ (dřív „Duely pozic“): jeden na jednoho, A1 proti
B1, A2 proti B2, A3 proti B3, A4 proti B4 podle snímku pozic v kole. Není to
jamkovka dvojic - ta je Four-ball. Formát je konfigurovatelný:

| `format`        | Pravidlo                                  |
| --------------- | ----------------------------------------- |
| `strokes-gross` | součet brutto ran, nižší vyhrává          |
| `strokes-net`   | součet netto ran, nižší vyhrává (výchozí) |

Přepínač **Netto** hry u duelů platí jen pro jamkovku (netto, nebo brutto
lepší míč); Rány a Stableford mají netto/brutto ve formátu. Best + Součet
formát nemá, tam platí jen Netto a allowance.
| `stableford` | součet Stablefordových bodů, vyšší vyhrává |
| `match-play` | jamkovka na netto rány, `2 UP`, `3&2`, `AS`, dormie |

V součtových formátech se porovnává jen přes jamky, které mají obě strany
zapsané (strana o jamku napřed „nevede“ jen proto, že má víc zapsáno), a
zvednutá jamka se počítá podle **centrálního pravidla turnaje** (níže).
Jamkovka hlásí **dormie** stejně jako Golfgames: vedoucí má náskok rovný
počtu jamek, které ještě nejsou odehrané (nezapsané i nehrané), a zápas
ještě není rozhodnutý - v hlavičce zápasu „Mac 2 UP · dormie“ a pod ní
„dormie · zbývají 2 jamky“.

Duel je dohraný po poslední jamce; jamkovka dřív, když je matematicky
rozhodnutá. Výchozí `countsForTeam: false` - do týmového skóre vstupuje až
po rozhodnutí administrátora; pak `win` a `halve` bodů za duel.

## Four-ball (`team-match`)

Dvojice proti dvojici, rána strany = lepší míč, formát jako u duelů
(výchozí jamkovka). Přepínač **Netto** hry rozhoduje, zda se lepší míč bere
z netto ran (s `allowance`, typicky 85-90 %) nebo brutto; v jamkovce se
plné rány všech hráčů na stejné jamce vykrátí, takže netto se 100 %
odpovídá hře „od nejnižšího“. **Dvojice plynou z flightů** (`flightPairs`,
`matchSides`): dva hráči téhož týmu ve flightu jsou dvojice, flight je
jeden zápas A proti B (tým A vlevo), v pořadí flightu. U hry se nic
nenastavuje; flight bez dvou a dvou hráčů zápas nemá a admin to vidí u
flightů. Stejné dvojice mají Best + Součet a Four-ball Skins. (Starší
data nesou `sides` u hry; vyhodnocení je nečte.) Body `win`/`halve` do
týmového skóre, výchozí `countsForTeam: true`.

## Four-ball Skins (`four-ball-skins`)

Dvojice proti dvojici (strany jako u Four-ballu, dva zápasy v kole), na
jamce se porovná **lepší míč** každé dvojice (netto podle přepínače Netto
a `allowance`, nebo brutto). Vítěz jamky bere skin, dělená jamka skin
přenáší dál (`carry`, výchozí ano; přenesené z poslední jamky propadají).
Po dohrání vyhrává dvojice s víc skiny: `win` bodů do týmu, remíza `halve`,
**za každý zápas zvlášť** (výchozí 1 / 0,5). Dvojitá 9 a 18
(`doubleHoles`) a extra body do hry (`bonuses`) jako u ostatních her.

**Bod za birdie** (`options.birdieBonus`): za každé birdie a lepší
kteréhokoli partnera (brutto, ze skutečných ran, hned po zápisu rány)
dostane dvojice bod do skóre zápasu navíc ke skinům; zvednutá jamka
birdie není. Skóre zápasu = skiny + birdie body.

**Double.** Oprávněná dvojice může jamku dublovat: jamka pak nese dva skiny
(dvojitá 9 a 18 čtyři), přenesené skiny z banku se jen přičtou, dělená
dublovaná jamka přenáší oba. Kdo smí dublovat, říká `options.doubleBy`:
`behind` prohrávající dvojice - méně ve **skóre zápasu včetně bodů za
birdie** (při rovnosti nikdo, výchozí), `lastLoser` dvojice, která prohrála
poslední vyhranou jamku (dělená jamka nic nemění), `anyone` kterákoli - když
dublují obě, každý Double zdvojnásobí a jamka je ×4, `off` nehraje se.
Bod za birdie se dvojitou jamkou ani Double nenásobí.

**Nezapsaná jamka uprostřed.** Bank i právo dublovat závisí na předchozích
jamkách, proto se jamky za první nezapsanou (`waitingHole`) nevyhodnocují,
dokud se nedoplní - karta ukáže „čeká na zápis N. jamky“. Body za birdie
se počítají hned ze zapsaných ran. Double je **surová buňka** jako extra body:
`round.doubles[hráč][jamka]` = seznam id her, zapisuje ho `setDouble`
(jedna buňka, `lastEdit`, log úprav), dvojice dublovala, když to má
kterýkoli její hráč. Jde přepnout kdykoli, i po zápisu ran; double u dvojice,
která dublovat nesměla, vyhodnocení ignoruje a zápis to ukáže. Zápis má
kartu zápasu: stav, o kolik skinů se hraje, kdo jamku vzal, tlačítko Double.

## Texas scramble dvojic (`texas-scramble`)

Oba hráči dvojice odpalují, vyberou lepší míč a z něj hrají oba dál až do
jamky - dvojice má na jamce **jedno skóre**. Dvojice plynou z flightů jako
u ostatních her dvojic (dva hráči téhož týmu ve flightu), hrají proti
dvojici druhého týmu ve flightu.

- **Zápis:** jeden řádek za dvojici (jména obou partnerů); klepnutí uloží
  totéž skóre oběma partnerům (dvě buňky, dva zápisy - rules beze změny).
  Evaluace bere lepší ze zapsaných čísel partnerů, takže nevadí, když jeden
  zápis chybí nebo se liší. Zvednutá jamka platí, jen když číslo nemá nikdo.
- **Handicap:** hrací HCP dvojice = 35 % nižšího + 15 % vyššího hracího HCP
  partnerů (doporučení WHS pro scramble dvojic), zaokrouhleno; podíly jdou
  v editoru hry změnit (`options.texasLow`, `options.texasHigh`), allowance
  hry se nepoužije. Rány dvojice se rozdělí podle SI jamek a zápis je ukazuje
  tečkami u dvojice.
- **Formát:** jako Four-ball - jamkovka (výchozí, s dormie), netto/brutto rány
  nebo Stableford dvojice; body do týmu za výhru a remízu zápasu.
- Individuální hry (Stableford, Skins) v kole Texasu dostanou skóre dvojice
  u obou partnerů - pro jednotlivce nemají smysl, admin je z kola odebere.

## Extra body (centrální, v každém kole)

**Do týmového skóre** jdou extra body jen přes hru, která má zapnuté
**Extra body do této hry** (`options.bonuses`): u Best + Součet se extra body
partnerů přičtou k bodům dvojice na jamce (jako v Golfgames), u ostatních
týmových her k bodům týmu z té hry sazbou `teamPerPoint` z Pravidel turnaje.
Bez takové hry jsou extra body jen vedlejší sázkou jednotlivců.

**Uložení.** Extra body jsou surová data jako rány: `round.bonuses[hráč][jamka]`
je seznam id bonusů (`['longest', 'sandie']`), zapisuje se jedna buňka
(`setBonuses`) a každá změna jde do logu úprav kola (`edits`: kdo, kdy, komu,
z čeho na co). Body za ně se nikam neukládají - počítají se při zobrazení
z téhle mapy a z centrální konfigurace, takže z nich mohou čerpat i další
hry a bonusy. Zapisují se hvězdičkou v řádku hráče v zápisu, panel nabídne
jen bonusy možné na dané jamce.

Vedlejší sázka podle Golfgames (`sideBets.ts`, `BONUSES`): hraje se vedle
her v **každém kole** a nastavuje se **jednou pro celý turnaj**
(`tournament.bonuses`, Admin → Pravidla turnaje), ne u hry ani u kola.

| Bonus     | Značka | Výchozí | Kdy                                           |
| --------- | ------ | ------- | --------------------------------------------- |
| `longest` | L      | 1       | kterákoli jamka (obvykle par 5), jediný hráč  |
| `nearest` | N      | 1       | kterákoli jamka (obvykle par 3), jediný hráč  |
| `sandie`  | S      | 1       | zaškrtává se (bunker a přesto dobrý výsledek) |
| `water`   | W      | 1       | zaškrtává se                                  |
| `barkie`  | T      | 1       | zaškrtává se (strom)                          |
| `arnie`   | A      | 1       | zaškrtává se (mimo fairway)                   |
| `birdie`  | B      | 0       | navíc proti Golfgames: automaticky z ran      |
| `eagle`   | E      | 0       | automaticky, eagle a lepší (bez birdie navíc) |

Hodnota 0 = bonus se nehraje a v zápisu se nenabízí. Zaškrtává se v zápisu
tlačítkem u jména hráče (nabízí jen zapnuté bonusy odpovídající paru);
značky jsou u jména i ve scorekartě, scorekarta má sloupec **Extra** se
součtem bodů a výsledky kola tabulku **Extra body** s rozpisem. Přehled
turnaje sčítá extra body jednotlivců přes kola.

Pravidla jako v Golfgames:

- Hodnota ostatních bonusů platí za **brutto** par; birdie a lepší ji
  násobí (`multipliers`, výchozí ×2 a ×3), bogey a horší bonus nepřizná.
  Rozdané rány mění, kdo jamku vyhrál, ne to, jak se zahrála.
- Longest a Nearest se nenásobí. S potvrzením (`confirmLongest`,
  `confirmNearest`, výchozí zapnuto) platí jen při paru a lepším: Longest
  osobním parem (par + rány z HCP, `longestByPersonalPar`), Nearest vždy
  brutto parem. **Nepotvrzený bod (bogey a horší, zvednutá jamka) jde
  soupeřům**: v Best + Součet k bodům druhé dvojice na té jamce, v jiné
  týmové hře s extra body druhému týmu; ve vedlejší sázce jednotlivců
  soupeř není, tam jen propadá. Dokud hráč jamku nezapsal, značka je
  tlumená - není jasno.
- **Kolo může Longest a Nearest přepsat** (`round.bonusRules`, Admin → kolo →
  Longest a Nearest, jako v Golfgames): jestli se hrají a čím se potvrzují -
  bez potvrzení, brutto par, nebo netto par (par + rány z HCP na jamce).
  Chybí-li přepis, platí Pravidla turnaje (`confirmLongest`, `confirmNearest`,
  `longestByPersonalPar`, `nearestByPersonalPar`). Vyhodnocení si přepis
  bere samo (`roundBonusConfig`).
- Longest a Nearest drží jediný hráč: zaškrtnutí u dalšího hráče ho
  předchozímu odebere; mají-li ho omylem dva (zápis bez signálu ze dvou
  telefonů), nedostane bod nikdo. Zvednutá jamka bonus nedává.
- Do týmového skóre jdou extra body jen přes hru s `options.bonuses`
  (viz Extra body), jinak jsou jen vedlejší sázkou.

## Best + Součet (`best-aggregate`)

Vzor Golfgames: dvě dvojice (strany jako u Four-ballu), na každé jamce
dvojici body: **1 za Best** (nižší lepší míč), **1 za součet** (nižší
součet ran obou partnerů), **1 za každé birdie** a **3 za každý eagle**
partnerů (brutto, ze skutečných ran). Volitelně **Double Best**
(`options.doubleBest`, bodů; 0 = nehraje se): bod navíc, když oba míče
dvojice porazí oba míče soupeře (vzdaný míč je nejhorší). Při shodě lepšího
míče nebo součtu bod nedostane nikdo. Jamka se počítá, až zapíší všichni čtyři. Lepší míč
a součet jsou netto podle přepínače Netto (s `allowance`); zvednutý míč je
v lepším míči vzdaný, v součtu má rány podle centrálního pravidla zvednuté
jamky. Vyhrává dvojice s víc body, body do týmu jako u Four-ballu (výhra /
remíza po dohrání). V zápisu je u každé dvojice Best, Součet a body na jamce
a průběžné skóre zápasu.

## Dvojité body na 9. a 18. jamce (`options.doubleHoles`)

Volba u hry (Stableford, Skins, Team Skins, Best + Součet): na devítce a
osmnáctce (`DOUBLE_HOLES`, podle čísla jamky, ne pořadí hraní) se násobí
dvěma vše, co jamka nese - Stablefordové body, hodnota skinu (dělená
dvojitá jamka přenáší dva skiny) a všechny body dvojice v Best + Součet
(Best, Součet, birdie, Double Best i extra body). Jamkovka a duely na rány
volbu nemají - jamka tam nemá body. V zápisu ukáže karta dvojic chip ×2.

## Team Skins zájezdu (souhrn přes kola)

Statistika na úvodní obrazovce, ne hra kola: `evaluations/teamSkinsTotal.ts`
spočítá každé odehrané kolo (ne plánované) stejnou evaluací jako Team Skins,
ale jednotně - celé kolo, dělená jamka přenáší, plný HCP - a to **netto
i brutto**. Nezávisí na tom, jestli a jak měl admin Team Skins v kole
nastavené, a do týmového skóre nic nepřidává.

Rozpis po klepnutí: po kolech jamky v pořadí hraní; vítězná jamka v barvě
týmu se jménem hráče, který zahrál rozhodující ránu (při shodě v týmu všichni),
rány obou týmů a počet skinů včetně banku; dělená jamka tlumeně s bankem.
Dole u kola, co zůstalo v banku a kolik jamek čeká na zápis všech osmi.

## Odznaky zájezdu (individuální statistiky)

Nejsou hra ani se neukládají: `evaluations/awards.ts` je počítá při zobrazení
z raw skóre všech kol, která nejsou jen naplánovaná (rozehraná i dohraná).
Každý odznak má držitele = všechny hráče na prvním místě s hodnotou > 0;
při shodě jsou držitelé všichni. Klepnutí na medaili ukáže tabulku všech
osmi hráčů s pořadím (shodné hodnoty sdílí pořadí).

| Odznak        | Co počítá                                                                             |
| ------------- | ------------------------------------------------------------------------------------- |
| STBák zájezdu | součet Stableford bodů netto (volby hry Stableford v kole, jinak netto s allowance 1) |
| Birdie Man    | birdie brutto                                                                         |
| Orel          | eagle a lépe brutto                                                                   |
| Parista       | pary brutto                                                                           |
| Žhavá série   | nejdelší souvislá řada jamek na par a lépe (brutto) v pořadí hraní                    |
| Skinař        | vyhrané skiny v individuálních Skins                                                  |
| Dlouhán       | potvrzené Longesty                                                                    |
| Ostrostřelec  | potvrzené Nearesty                                                                    |
| Bogie Man     | bogey brutto                                                                          |
| 2 Bogie Man   | double bogey                                                                          |
| 3 Bogie Man   | triple bogey                                                                          |
| Nenažranec    | čtyřbogey a hůř; zvednutá jamka se počítá                                             |
| No Stable Man | jamky bez jediného STB bodu (zvednutá jamka = 0 bodů)                                 |

Gratulace: přihlášený hráč, který odznak drží, ji vidí po načtení aplikace
jednou pro každý odznak; „viděno“ se drží v `localStorage` podle podpisu
odznaku (držitelé + hodnota), takže změna hodnoty nebo nový držitel gratulaci
ukáže znovu. Návštěvník gratulaci nevidí.

## Zvednutá jamka ve hře na rány (centrální pravidlo)

`tournament.pickup` = `timesPar × par + plus` (+ rány z handicapu na jamce
při `addStrokes`) brutto ran; v netto formátu se od nich odečtou rány z HCP.
Výchozí je netto dvojbogey (1 × par + 2 + rány), presety v adminu: 2× par,
2× par + 2, vlastní. Platí pro duely pozic a four-ball na brutto/netto rány.
Stableford dává za zvednutí nulu, ve Skins jamka propadá, jamkovku zvednutí
prohrává - tam pravidlo nic nemění.

## Týmové skóre turnaje

Součet `teamPoints` všech her s `countsForTeam: true` přes kola, která
nejsou `planned`. Dokud je jedinou takovou hrou Team Skins, přehled ho
označuje jako **předběžné**.

## Rozhodnutí tam, kde pravidla mlčí

- Netto se počítá z plného hracího HCP (allowance 100 %), ne relativně
  k nejlepšímu ve flightu - Team Skins jde přes dva flighty a relativní
  varianta by byla nekonzistentní.
- Lykia Links drží CR 74,7 ze slope tabulky (scorekarta uvádí 74,0); admin
  může hrací HCP přepsat ručně.
