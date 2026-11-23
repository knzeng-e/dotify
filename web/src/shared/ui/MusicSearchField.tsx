import { Search, X } from 'lucide-react';
import { useRef } from 'react';

type Props = {
  label: string;
  clearLabel: string;
  value: string;
  onChange: (value: string) => void;
};

export function MusicSearchField({ label, clearLabel, value, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className='music-search'>
      <Search size={18} aria-hidden='true' />
      <input ref={input} type='search' aria-label={label} placeholder={label} value={value} onChange={event => onChange(event.target.value)} />
      {value && (
        <button
          type='button'
          aria-label={clearLabel}
          onClick={() => {
            onChange('');
            input.current?.focus();
          }}
        >
          <X size={17} aria-hidden='true' />
        </button>
      )}
    </div>
  );
}
