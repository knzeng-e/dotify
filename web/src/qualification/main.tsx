import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HostQualification } from './HostQualification';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HostQualification />
  </StrictMode>
);
