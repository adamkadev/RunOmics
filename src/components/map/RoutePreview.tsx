import { cn } from '@/lib/utils'

const WIDTH = 1000
const HEIGHT = 560
const PADDING = 44

interface Props {
  routes: [number, number][][]
  ariaLabel: string
  className?: string
  dense?: boolean
}

function projectRoutes(routes: [number, number][][]): string[] {
  const coordinates = routes.flat()
  if (coordinates.length === 0) return []

  const bounds = coordinates.reduce(
    (current, [longitude, latitude]) => ({
      minLongitude: Math.min(current.minLongitude, longitude),
      maxLongitude: Math.max(current.maxLongitude, longitude),
      minLatitude: Math.min(current.minLatitude, latitude),
      maxLatitude: Math.max(current.maxLatitude, latitude),
    }),
    {
      minLongitude: Number.POSITIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
      minLatitude: Number.POSITIVE_INFINITY,
      maxLatitude: Number.NEGATIVE_INFINITY,
    },
  )
  const { minLongitude, maxLongitude, minLatitude, maxLatitude } = bounds
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.000001)
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.000001)
  const scale = Math.min(
    (WIDTH - PADDING * 2) / longitudeSpan,
    (HEIGHT - PADDING * 2) / latitudeSpan,
  )
  const projectedWidth = longitudeSpan * scale
  const projectedHeight = latitudeSpan * scale
  const offsetX = (WIDTH - projectedWidth) / 2
  const offsetY = (HEIGHT - projectedHeight) / 2

  return routes.map((route) =>
    route
      .map(([longitude, latitude]) => {
        const x = offsetX + (longitude - minLongitude) * scale
        const y = offsetY + (maxLatitude - latitude) * scale
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' '),
  )
}

function parsePoint(value: string | undefined): [number, number] | null {
  if (!value) return null
  const [x, y] = value.split(',').map(Number)
  return x === undefined || y === undefined ? null : [x, y]
}

export function RoutePreview({ routes, ariaLabel, className, dense = false }: Props) {
  const polylines = projectRoutes(routes)
  const firstRoute = routes[0]
  const firstPoint = parsePoint(polylines[0]?.split(' ')[0])
  const lastPoint = parsePoint(polylines[0]?.split(' ').at(-1))

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-route-preview={polylines.length > 0 ? 'ready' : 'loading'}
      className={cn('relative overflow-hidden bg-muted/70 text-accent-text', className)}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" aria-hidden="true">
        <g className="text-foreground/[0.06]" stroke="currentColor" strokeWidth="1">
          {Array.from({ length: 12 }, (_, index) => (
            <line key={`vertical-${index}`} x1={index * 100} y1="0" x2={index * 100} y2={HEIGHT} />
          ))}
          {Array.from({ length: 7 }, (_, index) => (
            <line key={`horizontal-${index}`} x1="0" y1={index * 100} x2={WIDTH} y2={index * 100} />
          ))}
        </g>

        {!dense && polylines[0] && (
          <polyline
            points={polylines[0]}
            fill="none"
            stroke="var(--background)"
            strokeWidth="15"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
        )}

        {polylines.map((points, index) => (
          <polyline
            key={`${index}-${points.slice(0, 24)}`}
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth={dense ? 4 : 8}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={dense ? 0.28 : 0.95}
          />
        ))}

        {!dense && firstRoute && firstPoint && lastPoint && (
          <>
            <circle cx={firstPoint[0]} cy={firstPoint[1]} r="11" fill="currentColor" stroke="var(--background)" strokeWidth="5" />
            <circle cx={lastPoint[0]} cy={lastPoint[1]} r="11" fill="var(--background)" stroke="currentColor" strokeWidth="5" />
          </>
        )}
      </svg>
    </div>
  )
}
