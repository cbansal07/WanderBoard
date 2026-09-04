import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class GlobalErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
          <h1>App Crashed!</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode intentionally double-invokes effects in development
  // to surface side-effect bugs early. Does not affect production builds.
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
);
