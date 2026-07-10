import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function setPixel(data, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width) return
  const i = y * (width * 4 + 1) + 1 + x * 4
  if (i < 1 || i + 3 >= data.length) return
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = a
}

function fillRect(data, width, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) setPixel(data, width, x, y, ...color)
  }
}

function fillCircle(data, width, cx, cy, radius, color) {
  const r2 = radius * radius
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) setPixel(data, width, x, y, ...color)
    }
  }
}

function makePng(size, out) {
  const rowBytes = size * 4 + 1
  const raw = Buffer.alloc(rowBytes * size)
  for (let y = 0; y < size; y += 1) raw[y * rowBytes] = 0

  const bg = [7, 7, 7, 255]
  const stone = [18, 18, 18, 255]
  const border = [214, 169, 51, 255]
  const gold = [239, 209, 111, 255]
  const shadow = [0, 0, 0, 255]

  fillRect(raw, size, 0, 0, size, size, bg)
  const block = Math.max(12, Math.floor(size / 9))
  for (let y = 0; y < size; y += block) {
    for (let x = (y / block) % 2 ? -block / 2 : 0; x < size; x += block) {
      fillRect(raw, size, Math.floor(x), y, block - 1, block - 1, stone)
    }
  }

  const pad = Math.floor(size * 0.08)
  fillRect(raw, size, pad, pad, size - pad * 2, Math.floor(size * 0.035), border)
  fillRect(raw, size, pad, size - pad - Math.floor(size * 0.035), size - pad * 2, Math.floor(size * 0.035), border)
  fillRect(raw, size, pad, pad, Math.floor(size * 0.035), size - pad * 2, border)
  fillRect(raw, size, size - pad - Math.floor(size * 0.035), pad, Math.floor(size * 0.035), size - pad * 2, border)

  const cx = Math.floor(size / 2)
  const cy = Math.floor(size / 2)
  fillCircle(raw, size, cx, cy, Math.floor(size * 0.31), shadow)
  fillCircle(raw, size, cx, cy, Math.floor(size * 0.27), border)
  fillCircle(raw, size, cx, cy, Math.floor(size * 0.21), [20, 20, 20, 255])

  const coinW = Math.floor(size * 0.28)
  const coinH = Math.floor(size * 0.08)
  fillRect(raw, size, cx - coinW / 2, cy - coinH * 1.8, coinW, coinH, gold)
  fillRect(raw, size, cx - coinW / 2, cy - coinH * 0.45, coinW, coinH, gold)
  fillRect(raw, size, cx - coinW / 2, cy + coinH * 0.9, coinW, coinH, gold)
  fillRect(raw, size, cx - coinW * 0.08, cy - coinH * 2.6, Math.max(4, Math.floor(size * 0.04)), Math.floor(size * 0.34), gold)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  writeFileSync(out, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

makePng(192, 'public/icon-192.png')
makePng(512, 'public/icon-512.png')
makePng(512, 'public/icon-maskable-512.png')
