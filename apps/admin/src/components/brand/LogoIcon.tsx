import type { SVGAttributes } from 'react';

/**
 * Nombaone icon glyph as an inline SVG, rendered with `fill="currentColor"` so
 * the colour is driven by the parent's `text-*` class. Inlined (vs an <Image>)
 * to avoid a network round-trip, an aspect-ratio warning, and a first-paint
 * flash; the glyph ships in the bundle. Geometry mirrors
 * `public/brand/logo-icon-{light,purple}.svg`.
 */
export function LogoIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 62.23 49.92"
      aria-hidden
      focusable="false"
      {...props}
    >
      <path
        d="M62.13,47.37L50.03,1.52c-.21-.81-.78-1.32-1.49-1.48-.58-.13-1.26.07-1.8.61L.64,46.42c-.83.82-.83,1.94-.12,2.69.66.7,1.77.83,2.62.13,3.87-3.24,7.98-5.95,12.62-7.96,15.26-6.64,30.8-2.19,43.2,8.07.74.61,1.69.8,2.43.29.67-.47,1.03-1.18.74-2.26ZM30.57,29.88c-.54,0-1.08.01-1.61.03l15.88-15.76,5.28,20.01c-6.36-2.82-12.95-4.27-19.54-4.27Z"
        fill="currentColor"
      />
    </svg>
  );
}
