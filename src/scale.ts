export interface FitResult {
  /** Facteur d'échelle à appliquer (entier pour le pixel art, fractionnaire pour la réduction). */
  scale: number;
  /** Vrai si l'image a été détectée comme du pixel art (plus grand côté <= seuil). */
  isPixelArt: boolean;
}

/**
 * Calcule le facteur de zoom "ajusté à la fenêtre".
 *
 * - Pixel art (max(largeur, hauteur) <= maxPixelArtSize) : échelle entière >= 1,
 *   pour garder des pixels nets.
 * - Autres images : réduites pour tenir dans la fenêtre, jamais agrandies (max 1).
 */
export function computeFitScale(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  maxPixelArtSize: number
): FitResult {
  if (imageWidth <= 0 || imageHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { scale: 1, isPixelArt: false };
  }

  const isPixelArt = Math.max(imageWidth, imageHeight) <= maxPixelArtSize;
  const fit = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);

  if (isPixelArt) {
    return { scale: Math.max(1, Math.floor(fit)), isPixelArt: true };
  }

  return { scale: Math.min(fit, 1), isPixelArt: false };
}
