import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logger.error("[ErrorBoundary] React render error", {
      error_message: error.message,
      stack: error.stack,
      component_stack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-destructive p-6">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Ocurrió un error en esta sección.</p>
          {this.state.error?.message && (
            <p className="text-xs text-muted-foreground max-w-sm text-center">{this.state.error.message}</p>
          )}
          <div className="flex gap-3">
            <button
              className="text-xs underline text-muted-foreground"
              onClick={() => window.location.reload()}
            >
              Recargar página
            </button>
            <button
              className="text-xs underline text-muted-foreground"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Reintentar sección
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
