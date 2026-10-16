import { useId } from 'react';
import { Radar } from 'lucide-react';
import { NEARBY_RADII } from '../../shared/nearby-v2.mjs';

export type RoomVisibilityChoice = { visibleNearby: boolean; worldwide?: boolean; radiusKm: number };

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
        max={42}
        step={1}
        value={value}
        aria-valuetext={`About ${value} kilometres`}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
      />
      <div className='nearby-radius-marks' aria-hidden='true'>
        {[5, 25, 42].map(radius => (
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
  describedBy,
  label = 'Visible nearby'
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
  label?: string;
}) {
  return (
    <label className='nearby-switch'>
      <input
        type='checkbox'
        role='switch'
        aria-label={label}
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
        <NearbySwitch
          checked={value.visibleNearby}
          describedBy={`${id}-description`}
          onChange={visibleNearby => onChange({ ...value, visibleNearby, worldwide: false })}
        />
      </div>
      <div className='nearby-heading nearby-worldwide-choice'>
        <div>
          <h3>Visible worldwide</h3>
          <p>Let anyone discover your room. No location needed.</p>
        </div>
        <NearbySwitch label='Visible worldwide' checked={!!value.worldwide} onChange={worldwide => onChange({ ...value, worldwide, visibleNearby: false })} />
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
