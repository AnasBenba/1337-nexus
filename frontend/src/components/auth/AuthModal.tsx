import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regLogin, setRegLogin] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullname, setRegFullname] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await login(loginIdentifier, loginPassword);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || 'Failed to sign in.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await register(regLogin, regEmail, regFullname, regPassword);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || 'Failed to create account.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeAuthModal}
          type="button"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[22px]">lock</span>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-on-surface">
              {tab === 'login' ? 'Sign In to 1337 Nexus' : 'Create Student Account'}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {tab === 'login' ? 'Access your project pitches and workspace' : 'Join the 42 peer collaboration network'}
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex bg-surface-container-low p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'login' 
                ? 'bg-surface-container-lowest text-on-surface shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'register' 
                ? 'bg-surface-container-lowest text-on-surface shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Username or Email
              </label>
              <input
                type="text"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="e.g. founder_b002a3 or student@1337.ma"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                42 Login / Username
              </label>
              <input
                type="text"
                required
                value={regLogin}
                onChange={(e) => setRegLogin(e.target.value)}
                placeholder="e.g. jdoe"
                className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Campus Email
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="jdoe@student.1337.ma"
                className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={regFullname}
                onChange={(e) => setRegFullname(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-outline-variant text-center">
          <p className="text-xs text-on-surface-variant">
            Or continue with{' '}
            <a 
              href="http://localhost:8000/api/v1/auth/oauth/42/login" 
              className="text-primary font-bold hover:underline"
            >
              42 Intra OAuth
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
