export function resolveRedirectTarget(locationState, fallbackPath) {
  const candidate = locationState?.from;

  if (typeof candidate === "string" && candidate.length > 0 && candidate !== "/login") {
    return candidate;
  }

  return fallbackPath;
}