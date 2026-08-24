/* ─── synthesized one-shot bell chime (no external audio file needed) ───
   A single shared AudioContext is created and unlocked the first time the
   user clicks anything in the app (satisfies the browser's autoplay policy,
   which blocks sound that isn't tied to a real user gesture). Every later
   bell — even ones triggered by a background timer — reuses that same
   already-unlocked context, so it can actually produce sound. */
let sharedAudioCtx: AudioContext | null = null
let audioUnlocked = false

export function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      sharedAudioCtx = new AudioCtx()
    }
    return sharedAudioCtx
  } catch {
    return null
  }
}

export function unlockAudio() {
  if (audioUnlocked) return
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ })
  }
  // play a near-silent buffer — fully unlocks audio output on some platforms
  // even when the context reports itself as already "running"
  try {
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // ignore
  }
  audioUnlocked = true
}

export function playOverdueBell(volume: number) {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* ignore */ })
    }
    const now = ctx.currentTime

    const tone = (freq: number, startGain: number, duration: number, delay: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      gain.gain.setValueAtTime(0.0001, now + delay)
      gain.gain.exponentialRampToValueAtTime(startGain * volume, now + delay + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + delay)
      osc.stop(now + delay + duration + 0.05)
    }

    const RING_COUNT = 3
    const RING_SPACING = 0.4 // seconds between the start of each ring
    for (let i = 0; i < RING_COUNT; i++) {
      const base = i * RING_SPACING
      tone(1046.5, 0.28, 0.3, base)         // C6
      tone(1568.0, 0.14, 0.2, base + 0.02)  // G6 overtone
    }
  } catch {
    // audio unavailable — fail silently, never block the app
  }
}
