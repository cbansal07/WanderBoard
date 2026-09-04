import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  panelKey?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error(`[PanelErrorBoundary] Panel "${this.props.panelKey}" crashed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="h-full flex flex-col items-center justify-center p-6 gap-3 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center border-2"
            style={{ background: 'var(--wb-paper-2)', borderColor: 'var(--wb-line)' }}
          >
            <span style={{ fontSize: 22 }}>⚠️</span>
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--wb-ink)' }}>
            Something went wrong in this panel.
          </p>
          <p className="text-xs" style={{ color: 'var(--wb-ink-soft)', maxWidth: 280 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            className="wb-btn wb-btn-ghost wb-btn-sm mt-1"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
