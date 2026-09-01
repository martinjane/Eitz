import React from "react";

/**
 * Eitashot logo — squircle with main star, 3 tiny sparkles, and animated color-shifting frame.
 */
export function EitashotLogo({ size = 40 }: { size?: number }) {
  const uid = React.useId().replace(/:/g, "");
  const filterId = `${uid}glow`;
  const frameId = `${uid}frame`;

  return (
    <svg width={size} height={size} viewBox="0 0 42 42" fill="none" className="eitashot-logo">
      <style>{`
        @keyframes eitashot-tw-a {
          0%, 20%, 100% { opacity: 0.25; }
          10%           { opacity: 0.95; }
        }
        @keyframes eitashot-tw-b {
          0%, 38%, 58%, 100% { opacity: 0.25; }
          48%               { opacity: 0.95; }
        }
        @keyframes eitashot-tw-c {
          0%, 72%, 92%, 100% { opacity: 0.25; }
          82%               { opacity: 0.95; }
        }
        @keyframes eitashot-frame-color {
          0%, 100% { stop-color: #FF8C38; }
          33%      { stop-color: #FFB366; }
          66%      { stop-color: #E05500; }
        }
        @keyframes eitashot-frame-color2 {
          0%, 100% { stop-color: #E05500; }
          33%      { stop-color: #FF8C38; }
          66%      { stop-color: #FFB366; }
        }
        .eitashot-logo .s1 { animation: eitashot-tw-a 2.8s ease-in-out infinite; }
        .eitashot-logo .s2 { animation: eitashot-tw-b 2.8s ease-in-out infinite; }
        .eitashot-logo .s3 { animation: eitashot-tw-c 2.8s ease-in-out infinite; }
        .eitashot-logo .frame-stop1 { animation: eitashot-frame-color 4s ease-in-out infinite; }
        .eitashot-logo .frame-stop2 { animation: eitashot-frame-color2 4s ease-in-out infinite; }
      `}</style>
      <defs>
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF8C38" />
          <stop offset="100%" stopColor="#E05500" />
        </linearGradient>
        <linearGradient id={frameId} x1="0" y1="0" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   className="frame-stop1" stopColor="#FF8C38" />
          <stop offset="100%" className="frame-stop2" stopColor="#E05500" />
        </linearGradient>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Solid animated frame — directly on the logo edge, zero gap */}
      <rect
        x="0.5" y="0.5" width="41" height="41" rx="10.5"
        fill="none"
        stroke={`url(#${frameId})`}
        strokeWidth="1"
      />

      {/* Squircle background — same rx and edge as frame */}
      <rect x="0.5" y="0.5" width="41" height="41" rx="10.5" fill={`url(#${uid}bg)`} />

      {/* Main four-pointed star */}
      <path
        d="M21,7 C22.6,13.4 27.6,18.4 34,20 C27.6,21.6 22.6,26.6 21,33 C19.4,26.6 14.4,21.6 8,20 C14.4,18.4 19.4,13.4 21,7Z"
        fill="white"
        fillOpacity="0.97"
      />

      {/* Spark A — top-left */}
      <g filter={`url(#${filterId})`}>
        <path
          className="s1"
          d="M29,6 C29.2,7.1 30,7.9 31.1,8.1 C30,8.3 29.2,9.1 29,10.2 C28.8,9.1 28,8.3 26.9,8.1 C28,7.9 28.8,7.1 29,6Z"
          fill="white"
        />
      </g>
      {/* Spark B — top-right */}
      <g filter={`url(#${filterId})`}>
        <path
          className="s2"
          d="M33.5,6 C33.7,7.1 34.5,7.9 35.6,8.1 C34.5,8.3 33.7,9.1 33.5,10.2 C33.3,9.1 32.5,8.3 31.4,8.1 C32.5,7.9 33.3,7.1 33.5,6Z"
          fill="white"
        />
      </g>
      {/* Spark C — below */}
      <g filter={`url(#${filterId})`}>
        <path
          className="s3"
          d="M31,12 C31.2,13 31.8,13.6 32.8,13.8 C31.8,14 31.2,14.6 31,15.6 C30.8,14.6 30.2,14 29.2,13.8 C30.2,13.6 30.8,13 31,12Z"
          fill="white"
        />
      </g>
    </svg>
  );
}
