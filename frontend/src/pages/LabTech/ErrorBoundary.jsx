import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service
    console.error("LabRequests error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-3">Something went wrong</h2>
          <p className="text-gray-600 mb-4">We're having trouble loading the lab requests.</p>
          <details className="text-left bg-gray-50 p-3 rounded-md mb-4 text-sm">
            <summary className="cursor-pointer font-medium">Error details</summary>
            <p className="mt-2 text-red-500 whitespace-pre-wrap">
              {this.state.error && this.state.error.toString()}
            </p>
            <div className="mt-2 text-gray-700 overflow-auto max-h-48">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </div>
          </details>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;