import { Component } from 'react'

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error) {
    console.error('Route render failed', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-white">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">Please refresh the page and try again.</p>
          <pre className="mt-4 p-4 bg-red-900/20 text-red-400 text-xs text-left overflow-auto rounded whitespace-pre-wrap">
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

export default RouteErrorBoundary
