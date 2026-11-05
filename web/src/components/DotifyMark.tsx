import { dotifyClefPath, dotifyOrbit } from '../shared/branding/dotifyMarkGeometry';

/** The shared Dotify mark: orbit and treble clef match the application header. */
export function DotifyMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 48 48' aria-hidden='true' focusable='false'>
      <g className='brand-mark-orbit'>
        {dotifyOrbit.map(([cx, cy, rx, ry, angle], index) => (
          <ellipse key={index} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${angle} ${cx} ${cy})`} />
        ))}
      </g>
      <circle className='brand-mark-core' cx='24' cy='24' r='12.75' />
      {/* Public-domain treble-clef silhouette, compacted for the Dotify mark. */}
      <path className='brand-mark-clef' d={dotifyClefPath} transform='translate(24 24) scale(.0059) translate(-1903.5 -7641)' />
    </svg>
  );
}
