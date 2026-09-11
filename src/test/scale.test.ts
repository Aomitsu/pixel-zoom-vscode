import { describe, expect, it } from 'vitest';
import { computeFitScale } from '../scale';

describe('computeFitScale', () => {
  it('zoome en entier une petite image pixel art', () => {
    const result = computeFitScale(16, 16, 512, 512, 128);
    expect(result.isPixelArt).toBe(true);
    expect(result.scale).toBe(32);
  });

  it('respecte le côté le plus contraignant', () => {
    const result = computeFitScale(16, 16, 100, 100, 128);
    expect(result.isPixelArt).toBe(true);
    expect(result.scale).toBe(6);
  });

  it('ne descend jamais sous 1x pour le pixel art', () => {
    const result = computeFitScale(128, 128, 32, 32, 128);
    expect(result.isPixelArt).toBe(true);
    expect(result.scale).toBe(1);
  });

  it('considère le seuil comme inclusif', () => {
    expect(computeFitScale(128, 128, 1000, 1000, 128).isPixelArt).toBe(true);
    expect(computeFitScale(129, 129, 1000, 1000, 128).isPixelArt).toBe(false);
  });

  it('affiche une grande image à 100% si elle tient dans la fenêtre', () => {
    const result = computeFitScale(256, 256, 1000, 1000, 128);
    expect(result.isPixelArt).toBe(false);
    expect(result.scale).toBe(1);
  });

  it('réduit une grande image trop volumineuse', () => {
    const result = computeFitScale(1024, 512, 512, 512, 128);
    expect(result.isPixelArt).toBe(false);
    expect(result.scale).toBe(0.5);
  });

  it('gère les dimensions invalides', () => {
    expect(computeFitScale(0, 0, 512, 512, 128)).toEqual({ scale: 1, isPixelArt: false });
    expect(computeFitScale(16, 16, 0, 0, 128)).toEqual({ scale: 1, isPixelArt: false });
  });
});
