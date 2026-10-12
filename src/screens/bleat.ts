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

/**
 * Vzdech k odznaku Ani piču: dýchavičné „áách“ - šum dechu přes pásmový filtr
 * a zastřený hlas, který se zvedne a pomalu klesne. Taky syntéza, bez souboru;
 * jen z klepnutí, kde audio není, tiše skončí.
 */
export function sigh(): void {
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
    const length = 2.2

    // Dech: bílý šum, pásmově zúžený, nádech a dlouhý výdech.
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const breath = ctx.createBufferSource()
    breath.buffer = buffer
    const breathFilter = ctx.createBiquadFilter()
    breathFilter.type = 'bandpass'
    breathFilter.frequency.value = 1400
    breathFilter.Q.value = 0.8
    const breathGain = ctx.createGain()
    breathGain.gain.setValueAtTime(0.0001, now)
    breathGain.gain.exponentialRampToValueAtTime(0.18, now + 0.25)
    breathGain.gain.exponentialRampToValueAtTime(0.05, now + 0.5)
    breathGain.gain.exponentialRampToValueAtTime(0.14, now + 0.8)
    breathGain.gain.exponentialRampToValueAtTime(0.0001, now + length)
    breath.connect(breathFilter)
    breathFilter.connect(breathGain)
    breathGain.connect(ctx.destination)

    // Hlas: měkký trojúhelník s vibratem, „á“ přes formant, tón se zvedne a sklesne.
    const voice = ctx.createOscillator()
    voice.type = 'triangle'
    voice.frequency.setValueAtTime(300, now + 0.55)
    voice.frequency.linearRampToValueAtTime(390, now + 0.9)
    voice.frequency.exponentialRampToValueAtTime(220, now + length)
    const vibrato = ctx.createOscillator()
    vibrato.frequency.value = 5.5
    const depth = ctx.createGain()
    depth.gain.value = 9
    vibrato.connect(depth)
    depth.connect(voice.frequency)
    const formant = ctx.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.value = 850
    formant.Q.value = 1.6
    const voiceGain = ctx.createGain()
    voiceGain.gain.setValueAtTime(0.0001, now + 0.5)
    voiceGain.gain.exponentialRampToValueAtTime(0.35, now + 0.85)
    voiceGain.gain.setValueAtTime(0.35, now + 1.1)
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + length)
    voice.connect(formant)
    formant.connect(voiceGain)
    voiceGain.connect(ctx.destination)

    breath.start(now)
    voice.start(now + 0.5)
    vibrato.start(now + 0.5)
    breath.stop(now + length)
    voice.stop(now + length + 0.05)
    vibrato.stop(now + length + 0.05)
  } catch {
    /* zvuk je bonus, bez něj odznak funguje dál */
  }
}
