import { useState } from "react";

export default function Tooltip({ content }) {
  const [open, setOpen] = useState(false);

  const isStructured =
    content &&
    typeof content === "object" &&
    !Array.isArray(content);

  const structuredRows = isStructured
    ? [
        ["What it is", content.what],
        ["Why it matters", content.why],
        ["Impact on assessment", content.impact],
        ["Tip", content.tip],
      ].filter(([, value]) => Boolean(value))
    : [];

  return (
    <div className="relative inline-block ml-2">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-sm bg-gray-200 text-gray-700 rounded-full w-5 h-5 flex items-center justify-center"
        aria-label="Show question help"
      >
        ?
      </button>

      {open && (
        <div className="absolute z-10 w-64 p-3 text-sm bg-white text-gray-700 rounded-lg shadow-lg top-7 left-0 border border-gray-200">
          {isStructured ? (
            <div className="space-y-2">
              {structuredRows.map(([label, value]) => (
                <div key={label}>
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{label}</div>
                  <div className="text-[13px] leading-relaxed">{value}</div>
                </div>
              ))}
            </div>
          ) : (
            content
          )}
        </div>
      )}
    </div>
  );
}
