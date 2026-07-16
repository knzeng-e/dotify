import { CircleAlert, CircleCheckBig, Info, X } from 'lucide-react';
import { useUiFeedback } from '../app/providers/UiFeedbackProvider';

export function ToastRegion() {
  const { notices, dismissNotice } = useUiFeedback();
  if (notices.length === 0) return null;

  return (
    <section className='toast-region' aria-label='Status messages' aria-live='polite'>
      {notices.map(notice => {
        const Icon = notice.tone === 'success' ? CircleCheckBig : notice.tone === 'error' ? CircleAlert : Info;
        return (
          <article className='toast-card' data-tone={notice.tone} key={notice.id}>
            <Icon size={18} aria-hidden='true' />
            <div>
              <strong>{notice.title}</strong>
              <p>{notice.message}</p>
            </div>
            <button type='button' className='toast-dismiss' onClick={() => dismissNotice(notice.id)} aria-label={`Dismiss ${notice.title}`}>
              <X size={14} />
            </button>
          </article>
        );
      })}
    </section>
  );
}
