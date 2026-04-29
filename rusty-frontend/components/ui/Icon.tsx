type IconProps = { className?: string; size?: number };

const make = (path: React.ReactNode) =>
  function I({ className, size = 16 }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {path}
      </svg>
    );
  };

export const IconOverview = make(<>
  <rect x="3" y="3" width="7" height="9" rx="1.5" />
  <rect x="14" y="3" width="7" height="5" rx="1.5" />
  <rect x="14" y="12" width="7" height="9" rx="1.5" />
  <rect x="3" y="16" width="7" height="5" rx="1.5" />
</>);

export const IconBrowsers = make(<>
  <rect x="3" y="4" width="18" height="16" rx="2" />
  <path d="M3 9h18" />
  <circle cx="6" cy="6.5" r="0.6" fill="currentColor" />
  <circle cx="8.5" cy="6.5" r="0.6" fill="currentColor" />
  <circle cx="11" cy="6.5" r="0.6" fill="currentColor" />
</>);

export const IconLogs = make(<>
  <path d="M5 4h11l3 3v13H5z" />
  <path d="M8 10h8M8 13h8M8 16h5" />
</>);

export const IconNodes = make(<>
  <circle cx="12" cy="5" r="2.2" />
  <circle cx="5" cy="19" r="2.2" />
  <circle cx="19" cy="19" r="2.2" />
  <path d="M12 7.2v5.6M10.4 13.6 6.5 17.2M13.6 13.6l3.9 3.6" />
</>);

export const IconSettings = make(<>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.27 16.96l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
</>);

export const IconPlus = make(<><path d="M12 5v14M5 12h14" /></>);
export const IconClose = make(<><path d="M18 6 6 18M6 6l12 12" /></>);
export const IconChevronRight = make(<><path d="m9 6 6 6-6 6" /></>);
export const IconChevronDown = make(<><path d="m6 9 6 6 6-6" /></>);
export const IconCamera = make(<>
  <path d="M3 7h3l2-3h8l2 3h3v12H3z" />
  <circle cx="12" cy="13" r="4" />
</>);
export const IconCheck = make(<><path d="m5 13 4 4L19 7" /></>);
export const IconRefresh = make(<>
  <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
  <path d="M21 3v5h-5" />
  <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
  <path d="M3 21v-5h5" />
</>);
export const IconAlert = make(<>
  <path d="M12 9v4M12 17h.01" />
  <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
</>);
export const IconTrash = make(<>
  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  <path d="M10 11v6M14 11v6" />
</>);
export const IconLogo = make(<>
  <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" stroke="none" />
  <path d="M8 8h5a3 3 0 0 1 0 6H9l5 6" stroke="var(--wb-inverse)" strokeWidth={1.8} />
</>);
