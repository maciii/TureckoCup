/**
 * Žalostné bečení k odznaku Nenažranec, syntetizované Web Audio API - žádný
 * soubor ke stahování. Volá se jen z klepnutí (prohlížeče jinak zvuk zakážou);
 * kde audio není, tiše skončí.
 */

let context: AudioContext | null = null

export function bleat(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return
    context ??= new Ctor()
    void context.resume()
    const ctx = context
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.connect(ctx.destination)

    // „Mé-é-é“: pila s vibratem přes pásmový filtr (formant), tón klesá - žalostně.
    const voice = ctx.createOscillator()
    voice.type = 'sawtooth'
    voice.frequency.setValueAtTime(340, now)
    voice.frequency.linearRampToValueAtTime(310, now + 0.5)
    voice.frequency.exponentialRampToValueAtTime(180, now + 1.4)
    const vibrato = ctx.createOscillator()
    vibrato.frequency.value = 8
    const depth = ctx.createGain()
    depth.gain.value = 22
    vibrato.connect(depth)
    depth.connect(voice.frequency)

    const formant = ctx.createBiquadFilter()
    formant.type = 'bandpass'
    formant.Q.value = 2.2
    formant.frequency.setValueAtTime(950, now)
    formant.frequency.linearRampToValueAtTime(620, now + 1.4)
    voice.connect(formant)
    formant.connect(master)

    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.6, now + 0.08)
    master.gain.setValueAtTime(0.6, now + 0.95)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)

    voice.start(now)
    vibrato.start(now)
    voice.stop(now + 1.55)
    vibrato.stop(now + 1.55)
  } catch {
    /* zvuk je bonus, bez něj odznak funguje dál */
  }
}
