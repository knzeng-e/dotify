import { useId } from 'react';
import { Radar } from 'lucide-react';
import { NEARBY_RADII } from '../../shared/nearby-v2.mjs';

export type RoomVisibilityChoice = { visibleNearby: boolean; radiusKm: number };

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
  const index = Math.max(0, NEARBY_RADII.indexOf(value));
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
        min={0}
        max={NEARBY_RADII.length - 1}
        step={1}
        value={index}
        aria-valuetext={`About ${value} kilometres`}
        disabled={disabled}
        onChange={event => onChange(NEARBY_RADII[Number(event.target.value)])}
      />
      <div className='nearby-radius-marks' aria-hidden='true'>
        {NEARBY_RADII.map(radius => (
          <span key={radius}>{radius} km</span>
        ))}
      </div>
    </div>
  );
}

export function NearbySwitch({
  checked,
  onChange,
  disabled = false,
  describedBy
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <label className='nearby-switch'>
      <input
        type='checkbox'
        role='switch'
        aria-label='Visible nearby'
        aria-describedby={describedBy}
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      <span className='nearby-switch-track' aria-hidden='true'>
        <span />
      </span>
    </label>
  );
}

/** A choice only: permission and publication start after opening the room. */
export function NearbyVisibility({ value, onChange }: { value: RoomVisibilityChoice; onChange: (value: RoomVisibilityChoice) => void }) {
  const id = useId();
  return (
    <section className='nearby-visibility' aria-labelledby={`${id}-title`}>
      <div className='nearby-heading'>
        <Radar size={23} aria-hidden='true' />
        <div>
          <h3 id={`${id}-title`}>Visible nearby</h3>
          <p id={`${id}-description`}>{value.visibleNearby ? 'Let people around you find this room.' : 'Off. Share your link or room code.'}</p>
        </div>
        <NearbySwitch checked={value.visibleNearby} describedBy={`${id}-description`} onChange={visibleNearby => onChange({ ...value, visibleNearby })} />
      </div>
      {value.visibleNearby && (
        <>
          <NearbyRadius value={value.radiusKm} onChange={radiusKm => onChange({ ...value, radiusKm })} label='Visibility range' />
          <p className='nearby-hint'>We’ll ask for your location when the room opens. Your exact position stays on this device.</p>
        </>
      )}
    </section>
  );
}
