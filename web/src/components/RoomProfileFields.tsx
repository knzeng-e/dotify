import { useId } from 'react';
export type RoomProfile = { name: string; introduction: string };
export function RoomProfileFields({ value, onChange }: { value: RoomProfile; onChange: (value: RoomProfile) => void }) {
  const id = useId();
  return (
    <div className='room-profile-fields'>
      <label htmlFor={`${id}-name`}>
        Room name <small>(optional)</small>
      </label>
      <input
        id={`${id}-name`}
        className='field'
        value={value.name}
        maxLength={60}
        placeholder='e.g. Late-night discoveries'
        onChange={event => onChange({ ...value, name: event.target.value })}
      />
      <label htmlFor={`${id}-intro`}>
        A short invitation <small>(optional)</small>
      </label>
      <textarea
        id={`${id}-intro`}
        className='field'
        rows={2}
        value={value.introduction}
        maxLength={240}
        placeholder='What would you like to share here?'
        onChange={event => onChange({ ...value, introduction: event.target.value })}
      />
      <p className='nearby-hint'>These stay with your room when the music changes.</p>
    </div>
  );
}
