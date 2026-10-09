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
| `match-play` | jamkovka na netto rány, `2 UP`, `3&2`, `AS` |

V součtových formátech se porovnává jen přes jamky, které mají obě strany
zapsané (strana o jamku napřed „nevede“ jen proto, že má víc zapsáno), a
zvednutá jamka se počítá podle **centrálního pravidla turnaje** (níže).
Duel je dohraný po poslední jamce; jamkovka dřív, když je matematicky
rozhodnutá. Výchozí `countsForTeam: false` - do týmového skóre vstupuje až
po rozhodnutí administrátora; pak `win` a `halve` bodů za duel.

## Four-ball (`team-match`)

Dvojice proti dvojici, rána strany = lepší míč, formát jako u duelů
(výchozí jamkovka). Přepínač **Netto** hry rozhoduje, zda se lepší míč bere
z netto ran (s `allowance`, typicky 85-90 %) nebo brutto; v jamkovce se
plné rány všech hráčů na stejné jamce vykrátí, takže netto se 100 %
odpovídá hře „od nejnižšího“. Strany (`sides`) jsou
čtyři dvojice po dvou zápasech: strany 1 a 2 hrají zápas 1, strany 3 a 4
zápas 2. Admin je nastaví v editoru hry (výchozí „Dvojice z flightů“: první
dvojice flightu proti druhé, tedy A1+A2 vs B1+B2 a A3+A4 vs B3+B4). Body
`win`/`halve` do týmového skóre, výchozí `countsForTeam: true`.

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
