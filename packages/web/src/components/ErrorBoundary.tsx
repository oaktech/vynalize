import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-4">:(</div>
          <h1 className="text-white text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-white/40 text-sm mb-6">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReload}
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white/80 hover:text-white transition-all duration-300 text-sm"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
