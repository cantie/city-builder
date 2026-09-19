import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ZOOM,
  DEFAULT_ZOOM_INDEX,
  ZOOM_LEVELS,
  lookAtTileFromBuildings,
  stepZoom,
} from '@/bridge/cameraZoom';

describe('camera zoom levels', () => {
  it('exposes four discrete zoom steps, defaulting to the most zoomed-out', () => {
    expect(ZOOM_LEVELS).toHaveLength(4);
    expect(ZOOM_LEVELS[0]).toBeLessThan(ZOOM_LEVELS[1]);
    expect(ZOOM_LEVELS[1]).toBeLessThan(ZOOM_LEVELS[2]);
    expect(ZOOM_LEVELS[2]).toBeLessThan(ZOOM_LEVELS[3]);
    expect(DEFAULT_ZOOM_INDEX).toBe(0);
    expect(DEFAULT_ZOOM).toBe(ZOOM_LEVELS[0]);
    expect(DEFAULT_ZOOM).toBeLessThan(1);
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
