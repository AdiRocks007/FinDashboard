'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null
    }
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }
  
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null
    })
  }
  
  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-lg border border-loss-200 bg-loss-50 p-6 text-center dark:border-loss-800 dark:bg-loss-900/20">
            <div className="mb-4 flex justify-center">
              <svg
                className="h-12 w-12 text-loss-500"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="mb-2 text-lg font-semibold text-loss-900 dark:text-loss-100">
              Something went wrong
            </h3>
            
            <p className="mb-4 text-sm text-loss-700 dark:text-loss-300">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            
            <button
              onClick={this.handleReset}
              className="rounded-lg bg-loss-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-loss-700 focus:outline-none focus:ring-2 focus:ring-loss-500 focus:ring-offset-2"
            >
              Try again
            </button>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-loss-700 dark:text-loss-300">
                  Error details
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-neutral-100 p-2 text-xs text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }
    
    return this.props.children
  }
}

export default ErrorBoundary

/**
 * Functional component wrapper for error boundary
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> => {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

