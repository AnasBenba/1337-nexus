import { useEffect, useState, type FormEvent } from 'react';
import './Login.css';

type View = 'student' | 'admin' | 'email';

const OAUTH_42_URL = '/api/auth/42'; // TODO: your backend route

/* ---------- background mesh (data-driven) ---------- */

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

/* ---------- small pieces ---------- */

function ShieldIcon({ size }: { size?: number }) {
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

function MailIcon({ size }: { size?: number }) {
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
        <span /><span />
      </div>
      <span className="logo-word">
        1337<b style={admin ? { color: 'var(--ink)' } : undefined}>.</b>nexus
        {admin && <span className="tag"> admin</span>}
      </span>
    </div>
  );
}

type CredentialsFormProps = {
  idPrefix: string;
  emailLabel: string;
  placeholder: string;
  submitLabel: string;
  submitClass: string;
  onSubmit: (email: string, password: string) => void;
};

function CredentialsForm({ idPrefix, emailLabel, placeholder, submitLabel, submitClass, onSubmit }: CredentialsFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(email, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-group">
        <label htmlFor={`${idPrefix}-email`}>{emailLabel}</label>
        <input
          id={`${idPrefix}-email`}
          className="field"
          type="email"
          placeholder={placeholder}
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field-group">
        <label htmlFor={`${idPrefix}-password`}>Password</label>
        <input
          id={`${idPrefix}-password`}
          className="field"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit" className={submitClass}>{submitLabel}</button>
    </form>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="back-link" onClick={onBack}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      Back to student login
    </button>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Toggle dark mode">
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}

/* ---------- views ---------- */

type StudentViewProps = { onAdmin: () => void; onEmail: () => void; onTerms: () => void };

function StudentView({ onAdmin, onEmail, onTerms }: StudentViewProps) {
  return (
    <div className="view">
      <div className="card">
        <Logo />

        <p className="eyebrow"><span className="dot" /> built for the 1337 / UM6P network</p>

        <h1>
          Find who you’re<br />
          <span className="accent">building with next.</span>
        </h1>

        <p className="desc">
          Nexus is where 1337 students discover real projects, find teammates who fill the gaps
          in their stack, and collaborate across every campus — from first commit to demo day.
        </p>

        <button type="button" className="btn-42" onClick={() => { window.location.href = OAUTH_42_URL; }}>
          <span className="fortytwo">42</span>
          Sign in with your 42 Intra account
        </button>

        <p className="subtext">
          <button type="button" className="terms-word" onClick={onTerms}>Terms</button>
        </p>

        <div className="divider"><span>OR</span></div>

        <div className="alt-actions">
          <button type="button" className="ghost-link" onClick={onAdmin}>
            <ShieldIcon />
            Login as Admin
          </button>
          <button type="button" className="ghost-link" onClick={onEmail}>
            <MailIcon />
            Continue with email
          </button>
        </div>
      </div>

      <p className="footnote">1337.nexus · prototype v0.1</p>
    </div>
  );
}

function AdminView({ onBack }: { onBack: () => void }) {
  return (
    <div className="view">
      <div className="card">
        <Logo admin />

        <div className="icon-badge"><ShieldIcon size={20} /></div>

        <h1 className="view-title">Administrator access</h1>
        <p className="desc view-desc">Restricted to platform staff only.</p>

        <CredentialsForm
          idPrefix="admin"
          emailLabel="Admin email"
          placeholder="you@1337.ma"
          submitLabel="Sign in"
          submitClass="admin-btn"
          onSubmit={(email) => {
            console.log('admin login', { email });
            // TODO: call POST /api/auth/admin/login
          }}
        />
      </div>

      <BackLink onBack={onBack} />
      <p className="footnote">1337.nexus · prototype v0.1</p>
    </div>
  );
}

function EmailView({ onBack }: { onBack: () => void }) {
  return (
    <div className="view">
      <div className="card">
        <Logo />

        <div className="icon-badge"><MailIcon size={20} /></div>

        <h1 className="view-title">Continue with email</h1>
        <p className="desc view-desc">Sign in with the email linked to your account.</p>

        <CredentialsForm
          idPrefix="email"
          emailLabel="Email"
          placeholder="you@1337.ma"
          submitLabel="Continue"
          submitClass="email-btn"
          onSubmit={(email) => {
            console.log('email login', { email });
            // TODO: call POST /api/auth/login
          }}
        />
      </div>

      <BackLink onBack={onBack} />
      <p className="footnote">1337.nexus · prototype v0.1</p>
    </div>
  );
}

/* ---------- terms modal ---------- */

function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
      <div className="modal-card">
        <div className="modal-head">
          <span>Terms &amp; Conditions</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <p>By using this prototype, you agree it’s for UI/UX exploration only — no real accounts, projects, or messages are stored.</p>
          <p>Content and mock data shown are illustrative and don’t represent real 1337 or UM6P students, projects, or opportunities.</p>
          <p>Don’t be a jerk in project chats. Be excellent to your teammates, across every campus.</p>
        </div>
        <button type="button" className="modal-ok" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function Login() {
  const [view, setView] = useState<View>('student');
  const [dark, setDark] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // The dark-mode CSS variables are keyed on <html class="dark">
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);

  return (
    <main className="login-page">
      <MeshBackground />
      <ThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />

      <div className="wrap">
        {view === 'student' && (
          <StudentView
            onAdmin={() => setView('admin')}
            onEmail={() => setView('email')}
            onTerms={() => setTermsOpen(true)}
          />
        )}
        {view === 'admin' && <AdminView onBack={() => setView('student')} />}
        {view === 'email' && <EmailView onBack={() => setView('student')} />}
      </div>

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </main>
  );
}