import { Link, useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-500 to-green-600 text-white">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3">
          <img src="/rera-logo.png" alt="RERA" className="h-9 w-auto" />
          <div className="font-bold text-xl">RERA</div>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-white/80 hover:text-white transition-colors">
            Sign In
          </Link>
          <button
            onClick={() => navigate("/new")}
            className="bg-white text-teal-700 px-5 py-2.5 rounded-lg font-semibold shadow-md hover:bg-gray-100 hover:scale-105 transition-all"
          >
            Start Free Risk Check →
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 px-6 lg:px-8 py-16 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-8">
            Check Real Estate Risk Before You Commit Your Money.
          </h1>

          <p className="text-lg text-white/95 mb-8 leading-relaxed max-w-2xl">
            Get a structured risk score based on permits, titles, developer credibility,
            and financial exposure so you do not miss critical red flags.
          </p>

          <ul className="space-y-3 mb-10 text-white/95 text-lg">
            <li>Regulatory and permit verification signals</li>
            <li>Title and land integrity checks</li>
            <li>Developer credibility assessment</li>
            <li>Financial and environmental risk exposure</li>
          </ul>

          <button
            onClick={() => navigate("/new")}
            className="bg-white text-teal-700 px-7 py-3.5 rounded-lg font-semibold shadow-lg hover:bg-gray-100 hover:scale-105 transition-all"
          >
            Start Free Risk Check →
          </button>

          <div className="text-sm text-white/90 mt-4 space-y-1">
            <p>✔ No account required</p>
            <p>✔ Takes 3-5 minutes</p>
          </div>
        </div>

        <div className="bg-white text-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all max-w-md mx-auto">
          <h3 className="text-xl font-semibold mb-2">Sample Risk Result</h3>
          <p className="text-sm text-gray-500 mb-4">
            Based on structured evaluation criteria used by RERA
          </p>

          <div className="bg-green-100 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600">Score</p>
            <p className="text-3xl font-bold">67 / 100</p>
            <p className="text-green-700 font-semibold">MODERATE RISK</p>
            <p className="text-sm text-gray-600 mt-2">
              Some compliance and financial concerns detected
            </p>
            <p className="text-sm text-gray-700 mt-3 font-medium">
              💡 Full breakdown available after evaluation
            </p>
          </div>

          <div className="text-sm space-y-1 mb-4">
            <p>Developer Legitimacy: 60</p>
            <p>Project Compliance: 60</p>
            <p>Title and Land: 70</p>
            <p>Financial Exposure: 55</p>
            <p>LGU / Environmental: 65</p>
          </div>

          <div className="border-t pt-4">
            <p className="font-semibold text-gray-800 mb-3">🔒 Full Report Includes:</p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>✔ Key risk signals</li>
              <li>✔ Missing documents</li>
              <li>✔ Due diligence checklist</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white/10 py-6 text-center text-white/90 px-6 lg:px-8">
        Used to evaluate real property transactions:
        <span className="ml-4">✔ Pre-selling developments</span>
        <span className="ml-4">✔ Private land transactions</span>
        <span className="ml-4">✔ Developer-led projects</span>
      </div>

      <div className="bg-white text-gray-800 py-16 px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center mb-10">How You Get Your Risk Score</h2>

        <div className="grid md:grid-cols-3 gap-8 text-center max-w-5xl mx-auto">
          <div>
            <h3 className="font-semibold mb-2">1. Answer guided questions</h3>
            <p className="text-sm text-gray-600">
              About the property and transaction
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">2. We analyze risk factors</h3>
            <p className="text-sm text-gray-600">
              Across compliance, title, and financial exposure
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">3. Get your risk score instantly</h3>
            <p className="text-sm text-gray-600">
              With clear signals and next steps
            </p>
          </div>
        </div>
      </div>

      <div className="text-center text-white/70 py-6 text-sm">
        Powered by HeptaGeeks
      </div>
    </div>
  );
}
