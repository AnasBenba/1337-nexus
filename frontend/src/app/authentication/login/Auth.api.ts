import { setAuthToken } from '@/lib/auth';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export function loginWith42(): void {
  window.location.assign(`${API_URL}/auth/login`);
}

export async function loginWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_or_email: email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || 'Invalid email or password' };
    }
    const data = await res.json();
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Network error occurred. Please try again.' };
  }
}

export async function registerWithEmail(
  login: string,
  email: string,
  fullname: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, email, fullname, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || 'Registration failed' };
    }
    const data = await res.json();
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Network error occurred. Please try again.' };
  }
}

export async function loginWithDev(login: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/dev-token?login=${login}`);
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
        return true;
      }
    }
  } catch {
    // fallback
  }
  return false;
}
