import { Link } from "react-router-dom";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <Link
            to="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back to Home
          </Link>
        </div>

        <p className="mb-6 text-sm text-slate-600">Last Updated: March 2026</p>

        <div className="space-y-7 text-sm leading-7 sm:text-base">
          <section>
            <h2 className="mb-2 text-xl font-semibold">1. Introduction</h2>
            <p>
              RERA (Real Estate Risk Assessment Platform) complies with the Data Privacy Act of
              2012 (Republic Act No. 10173) and its implementing rules and regulations. This
              policy explains how personal data is collected, used, stored, and protected.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">2. Personal Data Collected</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Personal information such as email address and account credentials</li>
              <li>User-submitted project, developer, and property information</li>
              <li>Questionnaire responses, evaluation results, and risk scores</li>
              <li>Request identifiers and usage logs</li>
              <li>Credit transactions, payment references, and subscription status</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">3. Purpose of Processing</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Generate risk evaluation reports</li>
              <li>Manage user accounts</li>
              <li>Process payments and credits</li>
              <li>Maintain billing and audit integrity</li>
              <li>Prevent fraud and abuse</li>
              <li>Improve system performance</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">4. Legal Basis for Processing</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Consent when users submit data and use the platform</li>
              <li>Contractual necessity to deliver evaluation services</li>
              <li>Legitimate interest for system security and fraud prevention</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">5. Data Sharing</h2>
            <p>
              Personal data may be shared with payment processors, infrastructure and hosting
              providers, and government authorities when legally required. RERA does not sell
              personal data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">6. Data Retention</h2>
            <p>
              Data is retained as needed for service operation, legal compliance, financial record
              keeping, and dispute resolution. Billing records, audit logs, and evaluation records
              linked to financial transactions may not be deleted immediately.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">7. User Rights (RA 10173)</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Be informed about data processing</li>
              <li>Access personal data</li>
              <li>Correct inaccurate data</li>
              <li>Object to processing where applicable</li>
              <li>Request deletion or blocking, subject to legal limitations</li>
              <li>File a complaint with the National Privacy Commission</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">8. Security Measures</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>JWT-based authentication</li>
              <li>Encrypted HTTPS data transmission</li>
              <li>Immutable audit logging</li>
              <li>Access control enforcement</li>
              <li>Rate limiting and abuse detection</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">9. Data Protection Officer</h2>
            <p>RERA designates a Data Protection Officer for privacy compliance.</p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">10. Breach Notification</h2>
            <p>
              If a data breach affecting personal data occurs, RERA will investigate promptly,
              notify affected users when required, and report to the National Privacy Commission
              where applicable.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">11. Cross-Border Data Transfer</h2>
            <p>
              If data is processed outside the Philippines, appropriate safeguards will be
              implemented and protection standards will be maintained.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">12. Changes to Policy</h2>
            <p>RERA may update this Privacy Policy and will provide notice where required.</p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">13. Contact</h2>
            <p>For privacy concerns, please contact the RERA support team.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
