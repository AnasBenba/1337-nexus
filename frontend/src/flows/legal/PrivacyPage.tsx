import React from 'react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 text-on-surface">
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-8 md:p-12 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[22px]">verified_user</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Privacy Policy</h1>
            <p className="text-sm text-on-surface-variant">Effective Date: November 10, 2026 • Version 1.0</p>
          </div>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-on-surface-variant">
          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">1. Information We Collect</h2>
            <p>
              1337 Nexus collects only the necessary information to provide collaborative workspace, AI pitch refinement, 
              and peer matchmaking services:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Account Information:</strong> Username/login, email address, display name, and hashed credentials. For 42 Intra logins, we store your campus intra ID and avatar URL.</li>
              <li><strong>Content Data:</strong> Project pitches, opportunity posts, candidate applications, canvas snapshot vectors, and chat messages.</li>
              <li><strong>Technical Data:</strong> IP address for rate-limiting, session cookies, and WebSocket connection state.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">2. How We Use Your Data</h2>
            <p>
              Your data is strictly utilized to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Authenticate your identity and maintain active sessions via secure HTTP-only cookies.</li>
              <li>Facilitate real-time messaging, canvas synchronization, and team recruitment workflows.</li>
              <li>Generate AI critiques and suggestions using the Google Gemini API (project pitches only, no private credentials are sent).</li>
              <li>Compute semantic match scores between opportunity skill requirements and candidate profiles.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">3. Cookies and Local Storage</h2>
            <p>
              We use standard session cookies (such as <code>access_token</code>) for authentication. 
              We do not track you across external third-party sites, and we do not sell or monetize student data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">4. Data Security</h2>
            <p>
              All external traffic is encrypted in transit using Transport Layer Security (TLS/HTTPS). 
              Passwords are salted and hashed using Argon2id before storage in PostgreSQL. 
              Real-time canvas updates are protected by transactional advisory locking to prevent data races.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">5. Your Data Rights</h2>
            <p>
              As a 42 student, you have the right to access, update, or delete your project pitches and applications 
              at any time through the 1337 Nexus interface. Deleting a pitch cascades to remove associated opportunities 
              and critiques permanently.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
