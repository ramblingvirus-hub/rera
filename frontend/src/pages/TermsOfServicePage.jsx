import { Link } from "react-router-dom";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
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
            <h2 className="mb-2 text-xl font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the RERA platform, you agree to be bound by these Terms of
              Service. If you do not agree, you must not use the service.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">2. Nature of the Service</h2>
            <p>
              RERA is a decision-support tool that provides risk-based assessments using structured
              evaluation models and user-provided information. Outputs are informational and
              educational only, and do not constitute legal, financial, or investment advice.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">3. User Responsibility</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Provide accurate information to the best of your knowledge</li>
              <li>Do not rely solely on RERA outputs for decisions</li>
              <li>Conduct independent due diligence and consult professionals</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">4. Account and Access</h2>
            <p>
              Certain features require account registration. You are responsible for account
              credentials and activities under your account.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">5. Billing and Credits</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>RERA uses a credit-based system</li>
              <li>Each evaluation consumes credits</li>
              <li>Credits are non-refundable once used</li>
              <li>Billing records are immutable for financial integrity</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">6. Report Access and Paywall</h2>
            <p>
              RERA may provide free summary outputs and paid full report access. Full report access
              requires payment or active entitlement.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, RERA is not liable for financial loss,
              purchase decisions, interpretation of results, user input errors, or downtime.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">8. No Warranty</h2>
            <p>
              The service is provided as is and as available. RERA makes no warranty of accuracy,
              completeness, reliability, or fitness for a particular purpose.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">9. Prohibited Use</h2>
            <p>
              You may not abuse the platform, attempt to reverse-engineer evaluation logic, or use
              outputs for defamation or malicious claims.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">10. Audit and System Integrity</h2>
            <p>
              RERA maintains immutable audit logs and financial records for billing accuracy,
              traceability, and dispute resolution.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">11. Data Retention</h2>
            <p>
              RERA may retain interview responses, reports, billing records, and audit logs for
              operation, financial records, and dispute handling.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">12. Termination</h2>
            <p>RERA may suspend, terminate, or restrict access at its sole discretion.</p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">13. Changes to Terms</h2>
            <p>RERA may update these terms. Continued use indicates acceptance of updates.</p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">14. Governing Law</h2>
            <p>These terms are governed by the laws of the Republic of the Philippines.</p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">15. Contact</h2>
            <p>For terms-related inquiries, please contact the RERA support team.</p>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-2 text-xl font-semibold">Dispute and Refund Policy</h2>
            <p className="mb-2">
              Credits are non-refundable once used. Refunds are only considered for verified system
              or billing errors such as duplicate charge, failed evaluation with deduction, or
              payment processed without credit issuance.
            </p>
            <p className="mb-2">
              Refunds are not granted for dissatisfaction with results, changed decisions, or
              incomplete/incorrect questionnaire inputs.
            </p>
            <p>
              Disputes must include account email, request ID (if available), and issue details.
              RERA reviews requests against immutable audit and billing records.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
