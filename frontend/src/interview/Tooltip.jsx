import { useEffect, useRef, useState } from "react";

export default function Tooltip({ content }) {
  const [open, setOpen] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateCanHover = () => setCanHover(media.matches);

    updateCanHover();
    media.addEventListener("change", updateCanHover);
    return () => media.removeEventListener("change", updateCanHover);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const isStructured =
    content &&
    typeof content === "object" &&
    !Array.isArray(content);

  const structuredRows = isStructured
    ? [
        ["Overview", content.detail || content.what],
        ["Why it matters", content.why],
        ["Impact on assessment", content.impact],
        ["Example", content.example || content.tip],
      ].filter(([, value]) => Boolean(value))
    : [];

  return (
    <div
      ref={containerRef}
      className="relative inline-block ml-2"
      onMouseEnter={canHover ? () => setOpen(true) : undefined}
      onMouseLeave={canHover ? () => setOpen(false) : undefined}
    >
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="text-sm bg-gray-200 text-gray-700 rounded-full w-5 h-5 flex items-center justify-center"
        aria-label="Show question help"
        aria-expanded={open}
      >
        ?
      </button>

      {open && (
        <div className="absolute z-10 w-64 p-3 text-sm bg-white text-gray-700 rounded-lg shadow-lg top-7 left-0 border border-gray-200">
          {isStructured ? (
            <div className="space-y-2">
              {content.title && (
                <div className="text-[13px] font-semibold leading-relaxed text-gray-800">
                  {content.title}
                </div>
              )}
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
