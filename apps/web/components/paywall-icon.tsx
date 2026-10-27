const LABEL = "Ofta betalvägg";

export function PaywallIcon() {
  return (
    <svg
      className="paywall-icon"
      role="img"
      aria-label={LABEL}
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{LABEL}</title>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
