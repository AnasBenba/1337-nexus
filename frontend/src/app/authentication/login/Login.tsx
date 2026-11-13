import React, { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LOGIN_PATTERN,
  PASSWORD_MAX,
  PASSWORD_MIN,
  RESERVED_LOGINS,
  isSignedIn,
  loginWith42,
  loginWithEmail,
  signupWithEmail,
} from './Auth.api';
import './Login.css';

type View = 'student' | 'email' | 'signup';

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

/* ---------- forms ---------- */

type FieldProps = {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

function Field({ id, label, error, hint, ...input }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`field${error ? ' invalid' : ''}`}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="field-error">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>
      )}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="form-error">{message}</p> : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm({ onDone }: { onDone: () => Promise<void> | void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return setError('Enter your email or username.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    try {
      await loginWithEmail(trimmed, password);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field
        id="login-email"
        label="Email or Username"
        type="text"
        placeholder="you@1337.ma or username"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        id="login-password"
        label="Password"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        required
        maxLength={PASSWORD_MAX}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <FormError message={error} />
      <button type="submit" className="email-btn" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

type SignupErrors = Partial<Record<'email' | 'login' | 'fullname' | 'password' | 'confirm', string>>;

function validateSignup(d: { email: string; login: string; fullname: string; password: string; confirm: string }): SignupErrors {
  const errors: SignupErrors = {};
  if (!EMAIL_PATTERN.test(d.email.trim())) errors.email = 'Enter a valid email address.';
  if (!LOGIN_PATTERN.test(d.login)) errors.login = '3–32 characters: lowercase letters, digits, - or _.';
  else if (RESERVED_LOGINS.has(d.login)) errors.login = 'This username is reserved.';
  if (!d.fullname.trim()) errors.fullname = 'Name is required.';
  if (d.password.length < PASSWORD_MIN) errors.password = `At least ${PASSWORD_MIN} characters.`;
  else if (!d.password.trim()) errors.password = "Password can't be only spaces.";
  if (d.confirm !== d.password) errors.confirm = "Passwords don't match.";
  return errors;
}

function SignupForm({ onDone }: { onDone: () => Promise<void> | void }) {
  const [form, setForm] = useState({ email: '', login: '', fullname: '', password: '', confirm: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = submitted ? validateSignup(form) : {};
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: key === 'login' ? e.target.value.toLowerCase() : e.target.value });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateSignup(form)).length) return;
    setBusy(true);
    setError(null);
    try {
      await signupWithEmail({
        email: form.email.trim(),
        login: form.login,
        fullname: form.fullname.trim(),
        password: form.password,
      });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field
        id="signup-email"
        label="Email"
        type="email"
        placeholder="you@1337.ma"
        autoComplete="email"
        required
        maxLength={254}
        value={form.email}
        onChange={set('email')}
        error={errors.email}
      />
      <Field
        id="signup-login"
        label="Username"
        placeholder="e.g. zbakkas"
        autoComplete="username"
        required
        maxLength={32}
        value={form.login}
        onChange={set('login')}
        error={errors.login}
        hint="Your profile handle across 1337 Nexus."
      />
      <Field
        id="signup-fullname"
        label="Display name"
        placeholder="Your full name"
        autoComplete="name"
        required
        maxLength={100}
        value={form.fullname}
        onChange={set('fullname')}
        error={errors.fullname}
      />
      <Field
        id="signup-password"
        label="Password"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        value={form.password}
        onChange={set('password')}
        error={errors.password}
        hint={`At least ${PASSWORD_MIN} characters.`}
      />
      <Field
        id="signup-confirm"
        label="Confirm password"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        value={form.confirm}
        onChange={set('confirm')}
        error={errors.confirm}
      />
      <FormError message={error} />
      <button type="submit" className="email-btn" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="back-link" onClick={onBack}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      Back
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

type StudentViewProps = { onEmail: () => void; onSignup: () => void; onTerms: () => void };

function StudentView({ onEmail, onSignup, onTerms }: StudentViewProps) {
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

        <button type="button" className="btn-42" onClick={loginWith42}>
          <span className="fortytwo">42</span>
          Sign in with your 42 Intra account
        </button>

        <p className="subtext">
          <button type="button" className="terms-word" onClick={onTerms}>Terms</button>
        </p>

        <div className="divider"><span>OR</span></div>

        <div className="alt-actions">
          <button type="button" className="ghost-link" onClick={onEmail}>
            <MailIcon />
            Sign in with email
          </button>
          <button type="button" className="ghost-link" onClick={onSignup}>
            <MailIcon />
            Create an account
          </button>
        </div>
      </div>

      <p className="footnote">1337.nexus · peer collaboration platform</p>
    </div>
  );
}

type FormViewProps = { onBack: () => void; onSwitch: () => void; onDone: () => Promise<void> | void };

function EmailView({ onBack, onSwitch, onDone }: FormViewProps) {
  return (
    <div className="view">
      <div className="card">
        <Logo />
        <div className="icon-badge"><MailIcon size={20} /></div>
        <h1 className="view-title">Sign in with email</h1>
        <p className="desc view-desc">Use the email or username and password of your Nexus account.</p>
        <LoginForm onDone={onDone} />
        <p className="switch-line">
          No account yet? <button type="button" className="terms-word" onClick={onSwitch}>Create one</button>
        </p>
      </div>
      <BackLink onBack={onBack} />
      <p className="footnote">1337.nexus · peer collaboration platform</p>
    </div>
  );
}

function SignupView({ onBack, onSwitch, onDone }: FormViewProps) {
  return (
    <div className="view">
      <div className="card">
        <Logo />
        <div className="icon-badge"><MailIcon size={20} /></div>
        <h1 className="view-title">Create your account</h1>
        <p className="desc view-desc">Sign up with your email, or use the 42 button on the previous screen.</p>
        <SignupForm onDone={onDone} />
        <p className="switch-line">
          Already have an account? <button type="button" className="terms-word" onClick={onSwitch}>Sign in</button>
        </p>
      </div>
      <BackLink onBack={onBack} />
      <p className="footnote">1337.nexus · peer collaboration platform</p>
    </div>
  );
}

function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
      <div className="modal-card">
        <div className="modal-head">
          <span>Terms &amp; Conditions</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <p>1337 Nexus is built for collaborative project formation and technical mentorship across 1337 and UM6P campuses.</p>
          <p>Respect peer contributions, maintain academic integrity, and collaborate constructively in shared workspaces and team chats.</p>
        </div>
        <button type="button" className="modal-ok" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [view, setView] = useState<View>('student');
  const [dark, setDark] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void isSignedIn().then((signedIn) => {
      if (cancelled) return;
      if (signedIn) navigate('/discover', { replace: true });
      else setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);

  const enterApp = async () => {
    await refreshUser();
    navigate('/discover', { replace: true });
  };
  const back = () => setView('student');

  if (checking) return null;

  return (
    <main className="login-page">
      <MeshBackground />
      <ThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />

      <div className="wrap">
        {view === 'student' && (
          <StudentView
            onEmail={() => setView('email')}
            onSignup={() => setView('signup')}
            onTerms={() => setTermsOpen(true)}
          />
        )}
        {view === 'email' && (
          <EmailView onBack={back} onSwitch={() => setView('signup')} onDone={enterApp} />
        )}
        {view === 'signup' && (
          <SignupView onBack={back} onSwitch={() => setView('email')} onDone={enterApp} />
        )}
      </div>

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </main>
  );
}

