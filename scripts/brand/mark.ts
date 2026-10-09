// The Santul mark as an SVG string, for the files pnpm brand:assets writes. The same geometry as
// components/brand/logo.tsx (LogoMark), without the hairline that only matters on a dark page.
export const BRAND = { ink: "#12150F", lime: "#A6D84A", offWhite: "#EDF1E6" } as const;

/**
 * rounded: the tile has its own rounded corners (favicon, manifest icons). Not rounded: a
 * full-bleed square for platforms that cut their own shape (Apple touch icon, Android maskable).
 * scale shrinks the plate about the centre, so a mask never clips it.
 */
export function markSvg({ rounded, scale = 1 }: { rounded: boolean; scale?: number }): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">`,
    `<rect width="120" height="120"${rounded ? ` rx="28"` : ""} fill="${BRAND.ink}"/>`,
    `<g transform="translate(60 60) scale(${scale}) translate(-60 -60) rotate(24 60 60)">`,
    `<path d="M57 23A31 31 0 0 0 57 85Z" fill="${BRAND.lime}"/>`,
    `<path d="M63 35A31 31 0 0 1 63 97Z" fill="${BRAND.offWhite}"/>`,
    `</g></svg>`,
  ].join("");
}
