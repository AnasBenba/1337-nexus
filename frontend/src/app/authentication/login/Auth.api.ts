const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function loginWith42(): void {
  window.location.assign(`${API_URL}/auth/login`);
}