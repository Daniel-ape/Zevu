// Minimal line icons (1.8px stroke, round caps), drawn for this app.
type P = { size?: number }
const base = (size = 22) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
})

export const Home = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></svg>
)
export const Search = ({ size }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
)
export const Scan = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 9v6M11 9v6M14 9v6M17 9v6" /></svg>
)
export const List = ({ size }: P) => (
  <svg {...base(size)}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 9h8M8 12.5h8M8 16h5" /></svg>
)
export const User = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="8.5" r="3.8" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></svg>
)
export const Paper = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 4h9.5L19 7.5V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M8.5 9h4M8.5 12.5h7M8.5 16h7" /></svg>
)
export const Back = ({ size }: P) => (
  <svg {...base(size)}><path d="m14.5 5-7 7 7 7" /></svg>
)
export const Chevron = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="m9.5 6 6 6-6 6" /></svg>
)
export const Plus = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
)
export const Minus = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12h14" /></svg>
)
export const Bell = ({ size }: P) => (
  <svg {...base(size)}><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5zM10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
)
export const Info = ({ size = 18 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>
)
export const Arrow = ({ size = 12, down }: P & { down?: boolean }) => (
  <svg {...base(size)} strokeWidth={2.4} style={{ transform: down ? 'rotate(180deg)' : undefined }}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
)
export const Check = ({ size }: P) => (
  <svg {...base(size)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)
export const Tag = ({ size }: P) => (
  <svg {...base(size)}><path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0z" /><circle cx="8.5" cy="8.5" r="1.4" /></svg>
)
export const Receipt = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></svg>
)
export const ArrowRight = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
