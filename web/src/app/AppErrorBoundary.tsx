import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dotify render failure', {
      message: error.message,
      componentStack: info.componentStack
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className='fatal-error-shell' role='alert'>
        <div className='fatal-error-card'>
          <span className='fatal-error-icon'>
            <CircleAlert size={22} />
          </span>
          <p className='eyebrow'>App recovery</p>
          <h1>Dotify could not render this view.</h1>
          <p>Refresh the page. If it happens again, check the browser console and the production readiness panel for the failing surface.</p>
          <button type='button' className='primary-action' onClick={() => window.location.reload()}>
            Reload Dotify
          </button>
        </div>
      </main>
    );
  }
}
