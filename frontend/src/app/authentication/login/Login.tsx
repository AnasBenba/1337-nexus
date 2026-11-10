import React, { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWith42, loginWithEmail, registerWithEmail, loginWithDev } from './Auth.api';
import './Login.css';

type View = 'student' | 'admin' | 'email' | 'register';

const MESH_LINES: [number, number, number, number][] = [
  [80, 90, 240, 60], [240, 60, 420, 140], [240, 60, 180, 220],
  [420, 140, 600, 90], [420, 140, 520, 280], [180, 220, 520, 280],
  [180, 220, 60, 380], [520, 280, 700, 360], [600, 90, 740, 200],
  [60, 380, 260, 470], [520, 280, 420, 480], [420, 480, 260, 470],
  [700, 360, 640, 520],
];

const MESH_NODES: { x: number; y: number; main?: boolean }[] = [
  { x: 80, y: 90 }, { x: 240, y: 60 }, { x: 420, y: 140, main: true },
  { x: 600, y: 90 }, { x: 180, y: 220 }, { x: 520, y: 280 },
  { x: 740, y: 200 }, { x: 60, y: 380 }, { x: 700, y: 360 },
  { x: 260, y: 470 }, { x: 420, y: 480 }, { x: 640, y: 520 },
];

function MeshBackground() {
  return (
    <svg className="mesh" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#1C9FEA" strokeOpacity="0.13" strokeWidth="1">
        {MESH_LINES.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <g fill="#1C9FEA" fillOpacity="0.55">
        {MESH_NODES.map(({ x, y, main }) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={main ? 4.5 : 3}
            fill={main ? '#0B84CC' : undefined}
            fillOpacity={main ? 1 : undefined}
          />
        ))}
      </g>
    </svg>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
    </svg>
  );
}

function MailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function Logo({ admin }: { admin?: boolean }) {
  return (
    <div className="logo">
      <div className="logo-mark" style={admin ? { background: 'var(--ink)' } : undefined}>
        <span />
        <span />
      </div>
      <span className="logo-word">
        1337<b style={admin ? { color: 'var(--ink)' } : undefined}>.</b>nexus
        {admin && <span className="tag"> admin</span>}
      </span>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="back-link" onClick={onBack}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      Back to student login
    </button>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
      <div className="modal-card">
        <div className="modal-head">
          <span>Terms &amp; Conditions</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>Welcome to 1337.Nexus — the peer collaboration network for 42 Network and 1337 students.</p>
          <p>Manage projects, form teams, refine pitches using AI, and collaborate across campuses.</p>
          <p>Treat your fellow peers with respect and adhere to school academic integrity standards.</p>
        </div>
        <button type="button" className="modal-ok" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('student');
  const [dark, setDark] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Form states
  const [emailOrLogin, setEmailOrLogin] = useState('');
  const [password, setPassword] = useState('');
  const [regLogin, setRegLogin] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullname, setRegFullname] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);

  const handleDevLogin = async (login: string) => {
    setLoading(true);
    const ok = await loginWithDev(login);
    setLoading(false);
    if (ok) {
      navigate('/');
      window.location.reload();
    } else {
      window.location.href = `/api/v1/auth/dev-login?login=${login}&redirect=/`;
    }
  };

  const handleEmailLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    const res = await loginWithEmail(emailOrLogin, password);
    setLoading(false);
    if (res.success) {
      navigate('/');
      window.location.reload();
    } else {
      setErrorMsg(res.error || 'Failed to sign in');
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    const res = await registerWithEmail(regLogin, regEmail, regFullname, regPassword);
    setLoading(false);
    if (res.success) {
      navigate('/');
      window.location.reload();
    } else {
      setErrorMsg(res.error || 'Registration failed');
    }
  };

  return (
    <main className="login-page">
      <MeshBackground />
      <ThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />

      <div className="wrap">
        {view === 'student' && (
          <div className="view">
            <div className="card">
              <Logo />

              <div className="eyebrow">
                <span className="dot" />
                intra-v2 network online
              </div>

              <h1>
                Find who you’re
                <br />
                <span className="accent">building with next.</span>
              </h1>

              <p className="desc">
                Nexus is where 1337 students discover real projects, find teammates who fill the gaps in their stack,
                and collaborate across every campus.
              </p>

              <button type="button" className="btn-42" onClick={loginWith42}>
                <span className="fortytwo">42</span>
                Sign in with 42 Intra
              </button>

              <div className="mt-4 p-3 bg-surface-container-low/70 rounded-xl border border-outline-variant/40 text-xs text-on-surface-variant flex flex-col items-center gap-1.5">
                <span className="font-semibold text-on-surface">Quick Test Sessions:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDevLogin('anas')}
                    className="px-3 py-1 bg-primary text-white rounded-md text-xs font-medium hover:opacity-90"
                  >
                    Login as @anas
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDevLogin('yassine')}
                    className="px-3 py-1 bg-secondary text-white rounded-md text-xs font-medium hover:opacity-90"
                  >
                    Login as @yassine
                  </button>
                </div>
              </div>

              <p className="subtext">
                <button type="button" className="terms-word" onClick={() => setTermsOpen(true)}>
                  Terms of Service
                </button>
              </p>

              <div className="divider">
                <span>OR</span>
              </div>

              <div className="alt-actions">
                <button type="button" className="ghost-link" onClick={() => setView('email')}>
                  <MailIcon />
                  Sign in with Email &amp; Password
                </button>
                <button type="button" className="ghost-link" onClick={() => setView('register')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  Create New Student Account
                </button>
                <button type="button" className="ghost-link" onClick={() => setView('admin')}>
                  <ShieldIcon />
                  Platform Admin Access
                </button>
              </div>
            </div>

            <p className="footnote">1337.nexus · enterprise v1.0</p>
          </div>
        )}

        {view === 'email' && (
          <div className="view">
            <div className="card">
              <Logo />
              <div className="icon-badge">
                <MailIcon size={20} />
              </div>
              <h1 className="view-title">Student Email Login</h1>
              <p className="desc view-desc">Sign in with your registered email or 1337 login handle.</p>

              {errorMsg && (
                <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleEmailLoginSubmit}>
                <div className="field-group">
                  <label htmlFor="email-login">Email or Login handle</label>
                  <input
                    id="email-login"
                    className="field"
                    type="text"
                    placeholder="anas or anas@student.1337.ma"
                    required
                    value={emailOrLogin}
                    onChange={(e) => setEmailOrLogin(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="email-pass">Password</label>
                  <input
                    id="email-pass"
                    className="field"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="email-btn" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
            <BackLink onBack={() => { setView('student'); setErrorMsg(null); }} />
            <p className="footnote">1337.nexus · enterprise v1.0</p>
          </div>
        )}

        {view === 'register' && (
          <div className="view">
            <div className="card">
              <Logo />
              <h1 className="view-title">Register Nexus Account</h1>
              <p className="desc view-desc">Join the peer network to collaborate, pitch, and recruit.</p>

              {errorMsg && (
                <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit}>
                <div className="field-group">
                  <label htmlFor="reg-login">Intra Login Handle</label>
                  <input
                    id="reg-login"
                    className="field"
                    type="text"
                    placeholder="e.g. mbarek"
                    required
                    value={regLogin}
                    onChange={(e) => setRegLogin(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="reg-email">Student Email</label>
                  <input
                    id="reg-email"
                    className="field"
                    type="email"
                    placeholder="mbarek@student.1337.ma"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="reg-name">Full Name</label>
                  <input
                    id="reg-name"
                    className="field"
                    type="text"
                    placeholder="First Last"
                    required
                    value={regFullname}
                    onChange={(e) => setRegFullname(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="reg-pass">Password</label>
                  <input
                    id="reg-pass"
                    className="field"
                    type="password"
                    placeholder="Minimum 8 characters"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="email-btn" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Register Account'}
                </button>
              </form>
            </div>
            <BackLink onBack={() => { setView('student'); setErrorMsg(null); }} />
            <p className="footnote">1337.nexus · enterprise v1.0</p>
          </div>
        )}

        {view === 'admin' && (
          <div className="view">
            <div className="card">
              <Logo admin />
              <div className="icon-badge">
                <ShieldIcon size={20} />
              </div>
              <h1 className="view-title">Administrator Access</h1>
              <p className="desc view-desc">Restricted to 1337 platform staff and moderators.</p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleDevLogin('anas');
                }}
              >
                <div className="field-group">
                  <label htmlFor="admin-email">Admin Email</label>
                  <input
                    id="admin-email"
                    className="field"
                    type="email"
                    placeholder="staff@1337.ma"
                    required
                    defaultValue="admin@1337.ma"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="admin-pwd">Staff Key / Password</label>
                  <input
                    id="admin-pwd"
                    className="field"
                    type="password"
                    placeholder="••••••••"
                    required
                    defaultValue="admin1234"
                  />
                </div>
                <button type="submit" className="admin-btn">
                  Enter Admin Console
                </button>
              </form>
            </div>
            <BackLink onBack={() => { setView('student'); setErrorMsg(null); }} />
            <p className="footnote">1337.nexus · enterprise v1.0</p>
          </div>
        )}
      </div>

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </main>
  );
};

export default Login;
