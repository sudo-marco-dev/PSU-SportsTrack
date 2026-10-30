import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    const isChunkLoadError = 
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('error loading dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.message?.includes('Loading chunk');

    if (isChunkLoadError) {
      try {
        const lastReload = sessionStorage.getItem('last_chunk_error_reload');
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
          sessionStorage.setItem('last_chunk_error_reload', String(now));
          window.location.reload();
          return { hasError: false, error: null };
        }
      } catch {
        // storage disabled or restricted
      }
    }

    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled UI exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const isChunkLoadError = 
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('error loading dynamically imported module') ||
        this.state.error?.message?.includes('Importing a module script failed') ||
        this.state.error?.message?.includes('Loading chunk');

      const title = isChunkLoadError ? 'New Update Available' : (this.props.fallbackTitle || 'Something Went Wrong');
      const message = isChunkLoadError 
        ? 'A fresh update of PSU SportsTrack was deployed while this tab was idle. Please reload to sync the latest match consoles.' 
        : (this.props.fallbackMessage || 'An unexpected runtime error occurred while rendering this view. Your data is safe.');

      return (
        <div className="min-h-[50dvh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 text-center shadow-xl space-y-4">
            <div className={`size-14 rounded-2xl ${isChunkLoadError ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'} flex items-center justify-center mx-auto`}>
              <AlertTriangle className="size-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {message}
              </p>
              {this.state.error?.message && !isChunkLoadError && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-[11px] text-rose-500 dark:text-rose-400 break-all text-left overflow-auto max-h-24">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <Button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto h-11 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/20"
              >
                <RefreshCw className="size-3.5" />
                <span>Reload Page</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto h-11 px-5 rounded-xl border-slate-200 dark:border-white/10 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="size-3.5" />
                <span>Return Home</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
