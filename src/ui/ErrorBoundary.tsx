import { Component, type ComponentChildren } from 'preact';
import { downloadBackup, getState } from '../store.ts';

/** If any screen ever fails to draw, show a calm explanation instead of a blank page. Data is untouched. */
export class ErrorBoundary extends Component<{ children: ComponentChildren }, { failed: boolean }> {
  state = { failed: false };

  componentDidCatch(error: unknown) {
    console.error('screen failed to render', error);
    this.setState({ failed: true });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div class="scroll" data-testid="error-screen">
        <div class="narrow stack">
          <div class="card center stack">
            <div class="hero">🌿</div>
            <h2>Something went wrong on this screen</h2>
            <p class="muted" style={{ margin: 0 }}>
              Your verses and progress are safe — they're stored on this device and nothing was changed. Try reloading. If it keeps happening, export a backup so you have a copy, and send feedback from the About page.
            </p>
            <button class="btn primary" onClick={() => location.reload()} data-testid="error-reload">
              Reload the app
            </button>
            <button
              class="btn"
              onClick={() => {
                if (getState().ready) downloadBackup();
              }}
            >
              Export a backup
            </button>
            <button
              class="btn ghost"
              onClick={() => {
                location.hash = '#/';
                this.setState({ failed: false });
              }}
            >
              Go to Today
            </button>
          </div>
        </div>
      </div>
    );
  }
}
