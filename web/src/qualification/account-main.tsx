import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountQualification } from './AccountQualification';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountQualification />
  </StrictMode>
);
