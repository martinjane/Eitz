import React from "react";

/**
 * Eitashot logo — clean rounded-square badge with a centred sparkle mark.
 *
 * Concept: a warm-orange squircle containing a single clean four-pointed
 * star (✦ aesthetic) built from cubic-bezier curves.  Simple, scales well
 * to any size, recognisable as an icon at 16 px and as a hero mark at 256 px.
 */
export function EitashotLogo({ size = 40 }: { size?: number }) {
  const uid = React.useId().replace(/:/g, "");

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        {/* Warm orange → amber background gradient */}
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF8C38" />
          <stop offset="100%" stopColor="#E05500" />
        </linearGradient>

        {/* Soft inner glow so the star floats */}
        <radialGradient id={`${uid}glow`} cx="50%" cy="50%" r="55%">
          <stop offset="0%"   stopColor="#FFEDD5" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFEDD5" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Squircle background */}
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill={`url(#${uid}bg)`} />

      {/* Very subtle top-left sheen */}
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill={`url(#${uid}glow)`} />

      {/* Four-pointed sparkle star via smooth cubic beziers
          Four cardinal points at distance 13 from centre (20,20);
          the curves bow inward so the silhouette reads as ✦.  */}
      <path
        d="M20,7 C21.6,13.4 26.6,18.4 33,20 C26.6,21.6 21.6,26.6 20,33 C18.4,26.6 13.4,21.6 7,20 C13.4,18.4 18.4,13.4 20,7Z"
        fill="white"
        fillOpacity="0.96"
      />

      {/* Secondary micro-sparkle offset up-right — gives it life */}
      <path
        d="M29.5,9 C29.9,10.9 31.1,12.1 33,12.5 C31.1,12.9 29.9,14.1 29.5,16 C29.1,14.1 27.9,12.9 26,12.5 C27.9,12.1 29.1,10.9 29.5,9Z"
        fill="white"
        fillOpacity="0.6"
      />
    </svg>
  );
}
