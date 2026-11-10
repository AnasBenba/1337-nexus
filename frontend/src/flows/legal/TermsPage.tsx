import React from 'react';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 text-on-surface">
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-8 md:p-12 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Terms of Service</h1>
            <p className="text-sm text-on-surface-variant">Effective Date: November 10, 2026 • Version 1.0</p>
          </div>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-on-surface-variant">
          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">1. Acceptance of Terms</h2>
            <p>
              Welcome to 1337 Nexus, the collaborative innovation and peer-review platform for the 42 Network. 
              By accessing or using 1337 Nexus, you agree to comply with and be bound by these Terms of Service. 
              If you do not agree to these terms, please refrain from using our application.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">2. Academic Integrity & 42 Charter</h2>
            <p>
              1337 Nexus operates under the 42 School Code of Conduct and Charter. You agree not to upload, pitch, 
              or distribute proprietary exam solutions, leak curriculum evaluation scales, or engage in academic dishonesty. 
              AI-assisted pitch refinement and copilot features are designed for learning and proposal drafting only.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">3. User Accounts & Identity</h2>
            <p>
              Users may register via 42 Intra OAuth or standard email/password authentication. You are responsible for 
              maintaining the confidentiality of your credentials and all activities that occur under your account. 
              Creating fake accounts or impersonating campus peers is strictly prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">4. User Content & Intellectual Property</h2>
            <p>
              You retain ownership of any project pitches, code snippets, canvas drawings, and recruitment postings you create. 
              By posting content on 1337 Nexus, you grant the platform a license to store, format, and display your content 
              to other students for collaboration and matchmaking.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">5. Real-Time Collaboration & Communication</h2>
            <p>
              Team chat, shared whiteboards, and recruitment applications must remain professional and respectful. 
              Harassment, hate speech, spamming, or abuse of WebSocket connections will result in immediate suspension.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-on-surface mb-2">6. Limitation of Liability</h2>
            <p>
              1337 Nexus is provided &quot;as is&quot; without warranties of any kind. As an educational software project built 
              within the 42 curriculum, the developers are not liable for any data loss, service interruptions, or project delays.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
