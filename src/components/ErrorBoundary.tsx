import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-red-500/40 text-center space-y-4 max-w-lg mx-auto my-8 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-400 mx-auto flex items-center justify-center shadow-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              {this.props.fallbackTitle || 'A rendering issue occurred'}
            </h3>
            <p className="text-xs text-zinc-400">
              {this.state.error?.message || 'The component recovered safely without crashing the application.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Component</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

