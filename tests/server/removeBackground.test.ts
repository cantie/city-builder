import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { removeBackground } from '../../server/removeBackground';

function makePng(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height, colorType: 6 });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (png.width * y + x) << 2;
      const [r, g, b, a] = paint(x, y);
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
  return Buffer.from(PNG.sync.write(png));
}

function pixel(
  buf: Buffer,
  x: number,
  y: number,
): [number, number, number, number] {
  const png = PNG.sync.read(buf);
  const i = (png.width * y + x) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
}

describe('removeBackground', () => {
  it('makes connected white studio background transparent and keeps the subject', () => {
    const src = makePng(16, 16, (x, y) =>
      x >= 5 && x <= 10 && y >= 5 && y <= 10
        ? [200, 40, 40, 255]
        : [255, 255, 255, 255],
    );
    const out = removeBackground(src);
    expect(pixel(out, 0, 0)[3]).toBe(0);
    expect(pixel(out, 15, 15)[3]).toBe(0);
    expect(pixel(out, 7, 7)).toEqual([200, 40, 40, 255]);
  });

  it('leaves already-transparent images unchanged', () => {
    const src = makePng(16, 16, (x, y) =>
      x >= 5 && x <= 10 && y >= 5 && y <= 10
        ? [30, 80, 200, 255]
        : [0, 0, 0, 0],
    );
    const out = removeBackground(src);
    expect(pixel(out, 0, 0)[3]).toBe(0);
    expect(pixel(out, 7, 7)).toEqual([30, 80, 200, 255]);
  });

  it('does not punch through a 1×1 fixture', () => {
    const src = makePng(1, 1, () => [12, 34, 56, 255]);
    const out = removeBackground(src);
    expect(pixel(out, 0, 0)).toEqual([12, 34, 56, 255]);
  });
});
