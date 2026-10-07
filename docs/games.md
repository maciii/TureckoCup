# Pravidla her

Jak aplikace vyhodnocuje jednotlivé hry. Každá hra kola je konfigurace
(`GameConfig`) a vyhodnocuje se nezávisle nad stejnými raw skóre - jde
přidat, změnit i smazat kdykoli, i po dohrání kola, a výsledek se přepočítá.

Společné pro všechny hry:

- Zapisuje se **brutto skóre** (počet ran). **Zvednutá jamka** je explicitní
  hodnota `0` (v UI tlačítko `×`); chybějící zápis znamená „ještě nezapsáno“.
- **Netto** = brutto minus rány podle hracího handicapu a stroke indexu.
  Hrací HCP = WHS z indexu a normy odpaliště hráče (`CR`, `SR`, par),
  případně ruční přepis administrátora; hra ho může krátit (`allowance`).
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

## Duely pozic (`position-duel`)

Samostatná výsledková vrstva (spec §7, §8): A1 proti B1, A2 proti B2, A3
proti B3, A4 proti B4 podle snímku pozic v kole. Formát je konfigurovatelný:

| `format`        | Pravidlo                                    |
| --------------- | ------------------------------------------- |
| `strokes-gross` | součet brutto ran, nižší vyhrává            |
| `strokes-net`   | součet netto ran, nižší vyhrává (výchozí)   |
| `stableford`    | součet Stablefordových bodů, vyšší vyhrává  |
| `match-play`    | jamkovka na netto rány, `2 UP`, `3&2`, `AS` |

V součtových formátech se porovnává jen přes jamky, které mají obě strany
zapsané (strana o jamku napřed „nevede“ jen proto, že má víc zapsáno), a
zvednutá jamka se počítá podle **centrálního pravidla turnaje** (níže).
Duel je dohraný po poslední jamce; jamkovka dřív, když je matematicky
rozhodnutá. Výchozí `countsForTeam: false` - do týmového skóre vstupuje až
po rozhodnutí administrátora; pak `win` a `halve` bodů za duel.

## Four-ball (`team-match`)

Dvojice proti dvojici, rána strany = lepší míč, formát jako u duelů
(výchozí jamkovka), `allowance` typicky 85-90 %. Strany (`sides`) jsou
čtyři dvojice po dvou zápasech: strany 1 a 2 hrají zápas 1, strany 3 a 4
zápas 2. Admin je nastaví v editoru hry (výchozí „Dvojice z flightů“: první
dvojice flightu proti druhé, tedy A1+A2 vs B1+B2 a A3+A4 vs B3+B4). Body
`win`/`halve` do týmového skóre, výchozí `countsForTeam: true`.

## Extra body (`bonuses`)

Vedlejší sázka podle Golfgames (`sideBets.ts`, `BONUSES`): hra určuje
hodnotu každého bonusu (`options.bonusValues`, 0 = nehraje se).

| Bonus     | Značka | Kdy                                            |
| --------- | ------ | ---------------------------------------------- |
| `longest` | L      | jen par 5, na jamce jediný hráč, zaškrtává se  |
| `nearest` | N      | jen par 3, na jamce jediný hráč, zaškrtává se  |
| `birdie`  | B      | automaticky z ran (brutto, nebo netto s `net`) |
| `eagle`   | E      | automaticky, eagle a lepší (bez birdie navíc)  |
| `sandie`  | S      | zaškrtává se (bunker a přesto dobrý výsledek)  |
| `water`   | W      | zaškrtává se                                   |
| `barkie`  | T      | zaškrtává se (strom)                           |
| `arnie`   | A      | zaškrtává se (mimo fairway)                    |

Zaškrtává se v zápisu tlačítkem u jména (nabízí jen bonusy zapnuté ve hře
a odpovídající paru jamky); značky jsou vidět u jména i ve scorekartě.
S `confirmByPar` platí ručně zapsaný bonus jen při paru a lepším (netto
podle `net`), jinak propadá - stejné „potvrzení parem“ jako v Golfgames.
Zvednutá jamka bonus nedává. Longest a Nearest drží jediný hráč:
zaškrtnutí u dalšího hráče ho předchozímu odebere; mají-li ho omylem dva
(zápis bez signálu ze dvou telefonů), nedostane bod nikdo. Do týmového
skóre (`countsForTeam`) jde součet bodů hráčů týmu × `teamPoints.perPoint`.

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
