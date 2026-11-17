import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Aplikasi gagal ditampilkan:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" style={{ maxWidth: 640, margin: '4rem auto', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>Halaman mengalami gangguan</h1>
          <p style={{ marginBottom: '1rem' }}>Muat ulang halaman. Jika masalah berulang, periksa error aplikasi di Console browser.</p>
          <button onClick={() => location.reload()}>Muat ulang halaman</button>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
