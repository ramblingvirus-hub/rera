const requiredVars = ["VITE_BACKEND_ORIGIN"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const missing = requiredVars.filter((name) => !isNonEmptyString(process.env[name]));

if (missing.length > 0) {
  console.error("Build blocked: missing required environment variable(s).\n");
  for (const variableName of missing) {
    console.error(`- ${variableName}`);
  }
  console.error("\nSet these in your frontend deployment provider before running build.");
  process.exit(1);
}

const backendOrigin = process.env.VITE_BACKEND_ORIGIN.trim();

if (!isValidAbsoluteHttpUrl(backendOrigin)) {
  console.error("Build blocked: VITE_BACKEND_ORIGIN must be an absolute http(s) URL.");
  console.error(`Received: ${backendOrigin}`);
  process.exit(1);
}

console.log(`Environment validation passed. Using VITE_BACKEND_ORIGIN=${backendOrigin}`);
