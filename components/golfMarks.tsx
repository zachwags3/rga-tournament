// Traditional golf scorecard notation:
//   eagle or better  -> two circles      birdie -> one circle
//   par              -> no mark
//   bogey            -> one square       double or worse -> two squares
export type Mark = { rings: 0 | 1 | 2; round: boolean; color: string }

const RED = '#c0392b'   // under par
const NAVY = '#091540'  // par and over

export function golfMark(diff: number | null): Mark | null {
  if (diff === null) return null
  if (diff <= -2) return { rings: 2, round: true, color: RED }
  if (diff === -1) return { rings: 1, round: true, color: RED }
  if (diff === 1) return { rings: 1, round: false, color: NAVY }
  if (diff >= 2) return { rings: 2, round: false, color: NAVY }
  return { rings: 0, round: false, color: NAVY } // par — plain number
}

// Absolutely-positioned rings, centred on the parent (which must be `relative`).
// pointer-events-none so they never block taps on an input underneath.
export function Rings({ mark, size }: { mark: Mark | null; size: number }) {
  if (!mark || mark.rings === 0) return null
  const radius = mark.round ? '50%' : '2px'
  const ring = (px: number, key: string) => (
    <span
      key={key}
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width: px,
        height: px,
        marginLeft: -px / 2,
        marginTop: -px / 2,
        border: `1.5px solid ${mark.color}`,
        borderRadius: radius,
      }}
    />
  )
  return (
    <>
      {ring(size, 'outer')}
      {mark.rings === 2 && ring(size - 6, 'inner')}
    </>
  )
}
