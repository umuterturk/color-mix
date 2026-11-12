type IconProps = {
  className?: string;
};

export function SoundOnIcon({ className = 'bar-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M4 10v4h4l5 4V6L8 10H4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 9.5a3.5 3.5 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M17 7a6.5 6.5 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SoundOffIcon({ className = 'bar-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M4 10v4h4l5 4V6L8 10H4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M16 9 21 15M21 9 16 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ReplayChordsIcon({ className = 'bar-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <path d="M8 6v12l10-6L8 6Z" fill="currentColor" />
      <path
        d="M5 5v14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
