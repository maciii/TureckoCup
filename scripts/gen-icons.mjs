// Generuje PWA ikony (jamka s praporkem na tmavě zeleném podkladu) bez
// externích závislostí - jen Node + zlib. Převzato z Golfgames, jiná kresba.
// Spouští se ručně přes `node scripts/gen-icons.mjs`, výstup se commituje.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    const src = y * width * 4
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, src, src + width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

const BG_TOP = [22, 48, 31]
const BG_BOTTOM = [11, 21, 15]
const ACCENT = [74, 222, 128]
const FLAG = [242, 193, 78]

/**
 * Kresba v souřadnicích 0-64 jako favicon.svg: green (elipsa), tyč a praporek.
 * `scale` zmenšuje kresbu u maskable ikony do bezpečné zóny.
 */
function drawIcon(size, scale) {
  const out = Buffer.alloc(size * size * 4)
  const ss = 4
  const unit = (size / 64) * scale
  const offset = (size - 64 * unit) / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0]
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = (x + (sx + 0.5) / ss - offset) / unit
          const py = (y + (sy + 0.5) / ss - offset) / unit
          let color = mix(BG_TOP, BG_BOTTOM, y / size)

          const ex = (px - 32) / 18
          const ey = (py - 46) / 7
          if (ex * ex + ey * ey < 1) color = mix(color, ACCENT, 0.35)
          if (px >= 30 && px <= 33 && py >= 14 && py <= 46) color = ACCENT
          // Trojúhelník praporku: (33,14) (52,21) (33,28).
          if (px >= 33 && px <= 52 && py >= 14 && py <= 28) {
            const half = 7 * (1 - (px - 33) / 19)
            if (Math.abs(py - 21) <= half) color = FLAG
          }
          acc = acc.map((v, i) => v + color[i])
        }
      }
      const i = (y * size + x) * 4
      const n = ss * ss
      out[i] = Math.round(acc[0] / n)
      out[i + 1] = Math.round(acc[1] / n)
      out[i + 2] = Math.round(acc[2] / n)
      out[i + 3] = 255
    }
  }
  return encodePng(size, size, out)
}

mkdirSync(publicDir, { recursive: true })
const files = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-512-maskable.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 1],
]
for (const [name, size, scale] of files) {
  writeFileSync(join(publicDir, name), drawIcon(size, scale))
  console.log(`${name} (${size}x${size})`)
}
