import "./holiday-themes.css";
import type { HolidayId } from "@/lib/holidays/holidays";

/**
 * Holiday atmosphere — full-bleed photo (public/holidays/<id>.jpg) under the
 * nav + main: art, dim wash, vignette.
 * Colours for the dim/vignette come from the --hl-* tokens in holiday-themes.css.
 */
export function HolidayAtmosphere({ id }: { id: HolidayId }) {
  return (
    <div
      className="hl-atmosphere pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="hl-art absolute inset-0"
        style={{ backgroundImage: `url(/holidays/${id}.jpg)` }}
      />
      <div className="hl-dim absolute inset-0" />
      <div className="hl-vignette absolute inset-0" />
    </div>
  );
}
