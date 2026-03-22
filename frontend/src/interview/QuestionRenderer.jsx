import Tooltip from "./Tooltip";

const INPUT_STYLE = {
  width: "100%",
  padding: "10px 13px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
  color: "#1a2332",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
};

function QuestionRenderer({ question, value, onChange }) {
  const handleChange = (event) => {
    onChange(question.id, event.target.value);
  };

  const helperText = question.helper || question.helperText;

  const isSignalMatch = (() => {
    if (!question.signal) {
      return false;
    }
    if (Array.isArray(question.signal.trigger)) {
      return question.signal.trigger.includes(value);
    }
    return value === question.signal.trigger;
  })();

  return (
    <div>
      {/* Section label */}
      {question.section && (
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "#2b9f94",
            marginBottom: "6px",
          }}
        >
          {question.section}
        </div>
      )}

      {/* Question label + helper */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "14px",
        }}
      >
        <label
          htmlFor={question.id}
          style={{
            display: "block",
            fontSize: "15px",
            fontWeight: 600,
            color: "#1a2332",
            lineHeight: "1.4",
          }}
        >
          {question.label}
        </label>

        {helperText && <Tooltip content={helperText} />}
      </div>

      {/* Text input */}
      {question.type === "text" && (
        <input
          id={question.id}
          type="text"
          value={value || ""}
          onChange={handleChange}
          placeholder="Type your answer…"
          style={INPUT_STYLE}
        />
      )}

      {/* Select dropdown */}
      {question.type === "select" && (
        <select
          id={question.id}
          value={value || ""}
          onChange={handleChange}
          style={{ ...INPUT_STYLE, cursor: "pointer" }}
        >
          <option value="">Select an option…</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {/* Radio — itemized card-style */}
      {question.type === "radio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          {question.options.map((option) => {
            const selected = value === option;
            return (
              <label
                key={option}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "11px 14px",
                  border: selected ? "1.5px solid #2b9f94" : "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                  backgroundColor: selected ? "#f0faf9" : "#ffffff",
                  cursor: "pointer",
                  transition: "border-color 0.12s, background-color 0.12s",
                  userSelect: "none",
                }}
              >
                {/* Custom radio dot */}
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: selected ? "2px solid #2b9f94" : "2px solid #d1d5db",
                    backgroundColor: selected ? "#2b9f94" : "#ffffff",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && (
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                        display: "block",
                      }}
                    />
                  )}
                </span>

                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={selected}
                  onChange={handleChange}
                  style={{ display: "none" }}
                />

                <span
                  style={{
                    fontSize: "14px",
                    color: selected ? "#1a2332" : "#374151",
                    fontWeight: selected ? 500 : 400,
                  }}
                >
                  {option}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {question.signal && isSignalMatch && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #fde68a",
            backgroundColor: "#fef3c7",
            color: "#92400e",
            fontSize: "12.5px",
            lineHeight: "1.5",
          }}
        >
          {question.signal.message}
        </div>
      )}
    </div>
  );
}

export default QuestionRenderer;