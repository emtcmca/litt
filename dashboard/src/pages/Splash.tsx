export function Splash() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      background: '#071410',
    }}>
      <img
        src="/icons-logo/litt-splash.png"
        alt="Litt"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

// ── legacy icon components kept for reference ──────────────────────────────
function GoogleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84-.0.01z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GeminiIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="gem-g" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285F4"/>
          <stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
      <path d="M12 2c0 0 .6 5.2 2.2 8C15.8 12.8 21 12 21 12s-5.2.8-6.8 3.6C12.6 18.4 12 22 12 22s-.6-3.6-2.2-6.4C8.2 12.8 3 12 3 12s5.2.8 6.8-2C11.4 7.2 12 2 12 2z" fill="url(#gem-g)"/>
    </svg>
  );
}

function CloudRunIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M18.5 10.2C17.83 6.97 14.97 4.5 11.5 4.5c-2.76 0-5.15 1.55-6.37 3.84C2.52 8.68.5 11.04.5 13.9c0 3.04 2.46 5.5 5.5 5.5H18c2.48 0 4.5-2.02 4.5-4.5 0-2.39-1.85-4.34-4-4.7z" fill="#4285F4" opacity=".25"/>
      <path d="M11.5 8.5l-3.5 3.5H10v4h3v-4h2l-3.5-3.5z" fill="#4285F4"/>
    </svg>
  );
}

function FirestoreIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M12 2s-5 4.5-5 9.5c0 2.5 1 4.7 2.7 6.3L8 22l4-2.5L16 22l-1.7-4.2C16 16.2 17 14 17 11.5 17 6.5 12 2 12 2z" fill="#FF8F00"/>
      <path d="M12 7s-3 3-3 5.5c0 1.5.6 2.8 1.6 3.8L10 19l2-1.2 2 1.2-.6-2.7c1-.9 1.6-2.3 1.6-3.8C15 10 12 7 12 7z" fill="#FFC107"/>
    </svg>
  );
}

function CloudTraceIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="4.5" cy="12" r="2" fill="#4285F4"/>
      <circle cx="12" cy="4.5" r="2" fill="#4285F4"/>
      <circle cx="19.5" cy="12" r="2" fill="#4285F4"/>
      <circle cx="12" cy="19.5" r="2" fill="#4285F4"/>
      <line x1="6.5" y1="12" x2="17.5" y2="12" stroke="#4285F4" strokeWidth="1.5" opacity=".45"/>
      <line x1="12" y1="6.5" x2="12" y2="17.5" stroke="#4285F4" strokeWidth="1.5" opacity=".45"/>
      <line x1="6" y1="10.5" x2="10.5" y2="6" stroke="#4285F4" strokeWidth="1" opacity=".3"/>
      <line x1="13.5" y1="6" x2="18" y2="10.5" stroke="#4285F4" strokeWidth="1" opacity=".3"/>
    </svg>
  );
}

