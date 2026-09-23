import { PNG } from 'pngjs';

const MIN_SIZE = 8;
const COLOR_THRESHOLD = 40;

type Rgb = [number, number, number];

function readPixel(
  data: Buffer,
  width: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const i = (width * y + x) << 2;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function colorDist(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleBackground(data: Buffer, width: number, height: number): Rgb | null {
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const colors = corners.map(([x, y]) => readPixel(data, width, x, y));
  if (colors.every((c) => c[3] === 0)) return null;
  const opaque = colors.filter((c) => c[3] > 0);
  if (opaque.length === 0) return null;
  const sum: Rgb = [0, 0, 0];
  for (const c of opaque) {
    sum[0] += c[0];
    sum[1] += c[1];
    sum[2] += c[2];
  }
  const n = opaque.length;
  return [(sum[0] / n) | 0, (sum[1] / n) | 0, (sum[2] / n) | 0];
}

export function removeBackground(pngBuf: Buffer): Buffer {
  let png: PNG;
  try {
    png = PNG.sync.read(pngBuf);
  } catch {
    return pngBuf;
  }
  const { width, height, data } = png;
  if (width < MIN_SIZE || height < MIN_SIZE) return pngBuf;

  const bg = sampleBackground(data, width, height);
  if (!bg) return Buffer.from(PNG.sync.write(png));

  const seen = new Uint8Array(width * height);
  const queue: number[] = [];

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (seen[i]) return;
    const [r, g, b, a] = readPixel(data, width, x, y);
    if (a === 0) {
      seen[i] = 1;
      return;
    }
    if (colorDist([r, g, b], bg) >= COLOR_THRESHOLD) return;
    seen[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (queue.length) {
    const i = queue.pop()!;
    const x = i % width;
    const y = (i / width) | 0;
    data[(i << 2) + 3] = 0;
    tryEnqueue(x - 1, y);
    tryEnqueue(x + 1, y);
    tryEnqueue(x, y - 1);
    tryEnqueue(x, y + 1);
  }

  return Buffer.from(PNG.sync.write(png));
}
