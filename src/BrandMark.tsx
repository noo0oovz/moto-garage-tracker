/**
 * The app logo: a garage with a wheel in it. The same artwork as public/favicon.svg and the installed-app icons, drawn here
 * in the theme's colours so it stays readable in light and dark (the file icons are fixed teal and white).
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center" style={{ width: size, height: size, background: 'var(--brand)', color: 'var(--brand-on)', borderRadius: size * 0.235 }} aria-hidden>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 29 32 11l22 18" strokeWidth="4.5" />
        <path d="M16 27v26h32V27" strokeWidth="4.5" />
        <circle cx="32" cy="40" r="9" strokeWidth="3.6" />
        <path d="M32 40v-9M32 40l-7.8 4.5M32 40l7.8 4.5" strokeWidth="2.6" />
        <circle cx="32" cy="40" r="2.4" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}
