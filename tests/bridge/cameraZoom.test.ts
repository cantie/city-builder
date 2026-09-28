import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ZOOM,
  DEFAULT_ZOOM_INDEX,
  ZOOM_LEVELS,
  lookAtTileFromBuildings,
  scrollAfterPan,
  scrollAfterZoom,
  stepZoom,
} from '@/bridge/cameraZoom';

describe('camera zoom levels', () => {
  it('exposes four discrete zoom steps, defaulting to level 3', () => {
    expect(ZOOM_LEVELS).toHaveLength(4);
    expect(ZOOM_LEVELS[0]).toBeLessThan(ZOOM_LEVELS[1]);
    expect(ZOOM_LEVELS[1]).toBeLessThan(ZOOM_LEVELS[2]);
    expect(ZOOM_LEVELS[2]).toBeLessThan(ZOOM_LEVELS[3]);
    expect(DEFAULT_ZOOM_INDEX).toBe(2);
    expect(DEFAULT_ZOOM).toBe(ZOOM_LEVELS[2]);
    expect(DEFAULT_ZOOM).toBe(1);
  });

  it('steps in and out without leaving the ladder', () => {
    expect(stepZoom(ZOOM_LEVELS[0], 1)).toBe(ZOOM_LEVELS[1]);
    expect(stepZoom(ZOOM_LEVELS[1], 1)).toBe(ZOOM_LEVELS[2]);
    expect(stepZoom(ZOOM_LEVELS[2], 1)).toBe(ZOOM_LEVELS[3]);
    expect(stepZoom(ZOOM_LEVELS[3], 1)).toBe(ZOOM_LEVELS[3]);
    expect(stepZoom(ZOOM_LEVELS[3], -1)).toBe(ZOOM_LEVELS[2]);
    expect(stepZoom(ZOOM_LEVELS[0], -1)).toBe(ZOOM_LEVELS[0]);
  });

  it('snaps a mid-step zoom onto the ladder before stepping', () => {
    const between = (ZOOM_LEVELS[1] + ZOOM_LEVELS[2]) / 2;
    expect(stepZoom(between, 1)).toBe(ZOOM_LEVELS[2]);
    expect(stepZoom(between, -1)).toBe(ZOOM_LEVELS[1]);
  });
});

describe('lookAtTileFromBuildings', () => {
  it('centers between main house and warehouse so both stay in view', () => {
    expect(
      lookAtTileFromBuildings([
        { typeId: 'warehouse', origin: { x: 20, y: 23 } },
        { typeId: 'main_house', origin: { x: 23, y: 23 } },
      ]),
    ).toEqual({ x: 21.5, y: 23 });
  });

  it('falls back to the main house when the warehouse is missing', () => {
    expect(
      lookAtTileFromBuildings([
        { typeId: 'farm', origin: { x: 0, y: 0 } },
        { typeId: 'main_house', origin: { x: 9, y: 9 } },
      ]),
    ).toEqual({ x: 9, y: 9 });
  });
});

describe('scrollAfterPan', () => {
  it('moves the camera opposite the pointer, scaled by zoom', () => {
    expect(scrollAfterPan(100, 200, 10, 20, 30, 50, 1)).toEqual({
      scrollX: 80,
      scrollY: 170,
    });
    expect(scrollAfterPan(0, 0, 0, 0, 40, -20, 2)).toEqual({
      scrollX: -20,
      scrollY: 10,
    });
  });
});

describe('scrollAfterZoom', () => {
  it('keeps the same world midpoint after zoom so the background does not jump', () => {
    expect(scrollAfterZoom(400, 300, 800, 600, 1)).toEqual({
      scrollX: 0,
      scrollY: 0,
    });
    expect(scrollAfterZoom(400, 300, 800, 600, 2)).toEqual({
      scrollX: 200,
      scrollY: 150,
    });
    expect(scrollAfterZoom(0, 0, 800, 600, 0.5)).toEqual({
      scrollX: -800,
      scrollY: -600,
    });
  });
});
