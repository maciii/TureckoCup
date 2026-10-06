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
zvednutá jamka se počítá jako netto dvojbogey (par + 2 + rány na jamce).
Duel je dohraný po poslední jamce; jamkovka dřív, když je matematicky
rozhodnutá. Výchozí `countsForTeam: false` - do týmového skóre vstupuje až
po rozhodnutí administrátora; pak `win` a `halve` bodů za duel.

## Týmový zápas (`team-match`)

Hlavní hra kola, až bude určena: strany z konfigurace (typicky dvojice ve
flightu, four-ball), rána strany = lepší míč, formát jako u duelů (výchozí
jamkovka). Body `win`/`halve` do týmového skóre.

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
- Extra body (longest, nearest …) mají v modelu místo (`bonuses`) a rules je
  pouštějí, ale žádná hra je zatím nevyhodnocuje.
