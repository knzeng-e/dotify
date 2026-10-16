import { useId } from 'react';
import { Globe2, Link2, Radar } from 'lucide-react';
import { NEARBY_RADII } from '../../shared/nearby-v2.mjs';

export type RoomVisibilityChoice = { visibleNearby: boolean; worldwide?: boolean; radiusKm: number };
export const NEARBY_MAX_RADIUS_KM = NEARBY_RADII[NEARBY_RADII.length - 1];

export function NearbyRadius({
  value,
  onChange,
  label = 'Distance',
  disabled = false
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className='nearby-radius'>
      <div className='nearby-radius-label'>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>About {value} km</output>
      </div>
      <input
        id={id}
        name='nearby-radius'
        type='range'
        min={NEARBY_RADII[0]}
        max={NEARBY_MAX_RADIUS_KM}
        step={1}
        value={value}
        aria-valuetext={`About ${value} kilometres`}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
      />
      <div className='nearby-radius-marks' aria-hidden='true'>
        {[NEARBY_RADII[0], 25, NEARBY_MAX_RADIUS_KM].map(radius => (
          <span key={radius}>{radius} km</span>
        ))}
      </div>
    </div>
  );
}

export type DiscoveryMode = 'link' | 'nearby' | 'everyone';

const discoveryOptions = [
  { mode: 'link', label: 'Link only', hint: 'People with your link or room code.', Icon: Link2 },
  { mode: 'nearby', label: 'Nearby', hint: 'People around you, within the range you choose.', Icon: Radar },
  { mode: 'everyone', label: 'Everyone', hint: 'Anyone on Dotify sees your name and this track, and can join. No location shared.', Icon: Globe2 }
] as const;

/** One choice for who can find a room; the three modes exclude each other. */
export function DiscoveryChoice({
  value,
  onChange,
  labelledBy,
  disabled = false,
  unavailable = {}
}: {
  value: DiscoveryMode;
  onChange: (mode: DiscoveryMode) => void;
  labelledBy: string;
  disabled?: boolean;
  unavailable?: Partial<Record<DiscoveryMode, boolean>>;
}) {
  const name = useId();
  return (
    <div className='discovery-choice' role='radiogroup' aria-labelledby={labelledBy}>
      {discoveryOptions.map(({ mode, label, hint, Icon }) => (
        <label key={mode} className='discovery-option' data-selected={value === mode}>
          <input
            type='radio'
            name={name}
            value={mode}
            checked={value === mode}
            disabled={disabled || unavailable[mode]}
            aria-labelledby={`${name}-${mode}-label`}
            aria-describedby={`${name}-${mode}`}
            onChange={() => onChange(mode)}
          />
          <Icon size={18} aria-hidden='true' />
          <span className='discovery-option-label' id={`${name}-${mode}-label`}>
            {label}
          </span>
          <span className='discovery-option-hint' id={`${name}-${mode}`}>
            {hint}
          </span>
        </label>
      ))}
    </div>
  );
}

/** A choice only: permission and publication start after opening the room. */
export function NearbyVisibility({ value, onChange }: { value: RoomVisibilityChoice; onChange: (value: RoomVisibilityChoice) => void }) {
  const id = useId();
  const mode: DiscoveryMode = value.worldwide ? 'everyone' : value.visibleNearby ? 'nearby' : 'link';
  return (
    <section className='nearby-visibility' aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Who can find this room?</h3>
      <DiscoveryChoice
        value={mode}
        labelledBy={`${id}-title`}
        onChange={next => onChange({ ...value, visibleNearby: next === 'nearby', worldwide: next === 'everyone' })}
      />
      {value.visibleNearby && (
        <>
          <NearbyRadius value={value.radiusKm} onChange={radiusKm => onChange({ ...value, radiusKm })} label='Visibility range' />
          <p className='nearby-hint'>We will ask for your location when the room opens. Your exact position stays on this device.</p>
        </>
      )}
    </section>
  );
}
