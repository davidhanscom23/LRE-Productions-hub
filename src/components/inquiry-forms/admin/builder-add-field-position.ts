/**
 * Inquiry Forms builder - where the Add field menu opens. PURE.
 *
 * The menu is min(34rem, 100vw - 2.5rem) wide and anchored to the button's left edge; on a phone the
 * button sits mid-row, so the menu ran ~120 px past the screen and the main column clipped it. The
 * offset pulls it left just enough to end 20 px from the right edge, never past 20 px from the left.
 */
const MENU_MAX_PX = 544;
const EDGE_PX = 20;

export function addFieldMenuOffset(input: { buttonLeft: number; viewportWidth: number }): number {
  const { buttonLeft, viewportWidth } = input;
  if (!Number.isFinite(buttonLeft) || !Number.isFinite(viewportWidth) || viewportWidth <= 0) return 0;
  const width = Math.min(MENU_MAX_PX, viewportWidth - 2 * EDGE_PX);
  const overflow = buttonLeft + width - (viewportWidth - EDGE_PX);
  if (overflow <= 0) return 0;
  return -Math.min(overflow, Math.max(0, buttonLeft - EDGE_PX));
}
