// Dot birth (Constellation phase C) - the single loading vocabulary: scattered
// particles converge into a sphere that lights up. One implementation, three
// sizes; used wherever something real is being resolved (catalog load, runtime
// resolution, uploads). Spec: docs/design/dotify-constellation-ux.md (E).
//
// Honesty rule: render it only while a real operation is in flight; it is a
// loading state, never an ambient decoration. Colors ride the ambient aura
// variables so the birth inherits whatever light the field is in.

type DotBirthProps = {
  size?: 'inline' | 'panel' | 'full';
  label?: string;
};

const PARTICLES = 8;

export function DotBirth({ size = 'panel', label }: DotBirthProps) {
  return (
    <div className='dot-birth' data-size={size} role='status' aria-live='polite' data-testid='dot-birth'>
      <span className='dot-birth-field' aria-hidden='true'>
        {Array.from({ length: PARTICLES }, (_, index) => (
          <i key={index} style={{ '--p': index / PARTICLES } as React.CSSProperties} />
        ))}
        <span className='dot-birth-core' />
      </span>
      {label && <span className='dot-birth-label'>{label}</span>}
    </div>
  );
}
