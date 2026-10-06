import { useEffect } from 'react'

/**
 * Tažení od levého okraje jako „zpět".
 *
 * Nainstalovaná PWA běží ve `display: standalone`, kde iOS ani Android
 * nedávají appce žádné systémové gesto zpět a není tam ani lišta prohlížeče
 * s šipkou. Tlačítko na obrazovce je proto jediná cesta zpět - a kdo appku
 * ovládá jednou rukou na jamce, sáhne po gestu dřív než po tlačítku
 * v horním rohu. Rozhodnutí #27 zavedlo historii, tohle jí dodává ovládání,
 * které v prohlížeči obstará systém.
 *
 * Gesto je záměrně diskrétní, ne interaktivní přetažení s náhledem předchozí
 * obrazovky: appka nemá router ani snímky obrazovek, takže by se předchozí
 * obrazovka musela držet vykreslená vedle té současné jen kvůli animaci.
 */

/** Pás u levého okraje, ze kterého gesto začíná. Mimo něj se nesleduje. */
const EDGE_WIDTH = 28

/** Kolik musí prst ujet doprava, aby to bylo „zpět", a ne omyl. */
const TRIGGER_DISTANCE = 70

/** Nad tímhle svislým posunem jde o rolování obsahu, ne o gesto. */
const MAX_VERTICAL_DRIFT = 45

/**
 * Leží dotek uvnitř něčeho, co se samo posouvá do stran?
 *
 * Scorekarta se posouvá uvnitř svého rámu a na telefonu sahá až k okraji
 * displeje. Bez téhle kontroly by tažení od levého okraje místo posunu
 * tabulky odnavigovalo pryč.
 */
function insideHorizontalScroller(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null
  while (element) {
    if (element.scrollWidth > element.clientWidth) {
      const overflowX = getComputedStyle(element).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
    element = element.parentElement
  }
  return false
}

/**
 * Zapne gesto zpět. `enabled` je `false` na výchozí obrazovce - odtud by
 * „zpět" znamenalo opustit appku, což gestem uprostřed hry nikdo nechce.
 */
export function useSwipeBack(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    let startX = 0
    let startY = 0
    let tracking = false

    function onTouchStart(event: TouchEvent) {
      tracking = false
      // Dva prsty jsou přiblížení nebo posun, ne navigace.
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (!touch || touch.clientX > EDGE_WIDTH) return
      if (insideHorizontalScroller(event.target)) return
      startX = touch.clientX
      startY = touch.clientY
      tracking = true
    }

    function onTouchMove(event: TouchEvent) {
      if (!tracking) return
      const touch = event.touches[0]
      if (!touch) return
      // Jakmile se prst rozjede svisle, je to rolování - gesto se zahodí
      // a už se v tomhle tahu neobnoví.
      if (Math.abs(touch.clientY - startY) > MAX_VERTICAL_DRIFT) tracking = false
    }

    function onTouchEnd(event: TouchEvent) {
      if (!tracking) return
      tracking = false
      const touch = event.changedTouches[0]
      if (!touch) return
      if (touch.clientX - startX < TRIGGER_DISTANCE) return
      if (Math.abs(touch.clientY - startY) > MAX_VERTICAL_DRIFT) return
      window.history.back()
    }

    // Pasivně: gesto nic nepřebíjí, jen poslouchá, takže rolování zůstane
    // plynulé i na slabším telefonu.
    const options: AddEventListenerOptions = { passive: true }
    window.addEventListener('touchstart', onTouchStart, options)
    window.addEventListener('touchmove', onTouchMove, options)
    window.addEventListener('touchend', onTouchEnd, options)
    window.addEventListener('touchcancel', onTouchEnd, options)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled])
}
