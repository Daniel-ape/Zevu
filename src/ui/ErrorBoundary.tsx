// If a screen ever fails to draw, show a calm page with a way back instead of
// a white screen. A second failure right away reloads the whole app.
import { Component, type ReactNode } from 'react'

const KEY = 'zevu:crashAt'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) {
    console.error('screen failed', error)
    try {
      const last = Number(sessionStorage.getItem(KEY) ?? 0)
      sessionStorage.setItem(KEY, String(Date.now()))
      // failed twice within half a minute: start the app over
      if (Date.now() - last < 30_000) { sessionStorage.removeItem(KEY); location.reload() }
    } catch { /* ignore */ }
  }
  render() {
    if (!this.state.failed) return this.props.children
    const sv = (localStorage.getItem('hintaopas:lang') ?? '').includes('sv'), fi = (localStorage.getItem('hintaopas:lang') ?? '').includes('fi')
    const text = sv ? ['Något gick fel', 'Försök igen'] : fi ? ['Jokin meni vikaan', 'Yritä uudelleen'] : ['Something went wrong', 'Try again']
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center', fontFamily: 'inherit' }}>
        <div>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
          <h2 style={{ margin: '0 0 18px', fontSize: 22 }}>{text[0]}</h2>
          <button className="btn primary" style={{ width: 'auto', padding: '0 28px' }} onClick={() => { location.hash = '#home'; this.setState({ failed: false }) }}>{text[1]}</button>
        </div>
      </div>
    )
  }
}
