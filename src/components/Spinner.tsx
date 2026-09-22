export default function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-brand-600 ${className || 'size-6'}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="กำลังโหลด"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
