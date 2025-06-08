import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <p>Something went wrong.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
