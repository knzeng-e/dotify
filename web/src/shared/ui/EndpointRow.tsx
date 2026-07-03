import type { ReactNode } from 'react';

export function EndpointRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='endpoint-row'>
      <span>{label}</span>
      <div className='endpoint-value'>{value}</div>
    </div>
  );
}
