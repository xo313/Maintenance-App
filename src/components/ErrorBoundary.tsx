import React from 'react';

interface State { hasError: boolean; error: string }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, error: String(err?.message || err || 'خطأ غير متوقع') };
  }

  componentDidCatch(err: any, info: any) {
    console.error('[ErrorBoundary] Caught error:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', gap: '16px',
          color: 'var(--text)', textAlign: 'center', padding: '2rem'
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--danger)', margin: 0 }}>حدث خطأ في تحميل الصفحة</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
            {this.state.error}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: '' })}
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
