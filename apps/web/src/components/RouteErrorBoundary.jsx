import { Component } from 'react'

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
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
        </div>
      )
    }

    return this.props.children
  }
}

export default RouteErrorBoundary
