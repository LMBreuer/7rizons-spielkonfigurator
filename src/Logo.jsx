import React, { useId } from "react";
import original from "./assets/7rizons-logo.png";

// Render the original pixels inside a tight SVG viewport. The source PNG stays unchanged.
export default function Logo({ wordmark = false, className, inverse }) {
  const id = useId();
  const clip = id + "-area";
  const light = id + "-wordmark";
  return (
    <svg
      className={className || (wordmark ? "hero-wordmark" : "brand-logo")}
      viewBox={wordmark ? "1400 213 1925 759" : "568 213 2757 759"}
      role="img"
      aria-label="7’rizons"
    >
      <defs>
        <clipPath id={clip}>
          <rect x="1400" y="180" width="2000" height="850" />
        </clipPath>
        <filter id={light} x="0" y="0" width="100%" height="100%">
          <feFlood floodColor="#f2f6fc" />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
      <image href={original} width="4096" height="1186" />
      {inverse !== false && (
        <g
          className={inverse ? undefined : "logo-dark-wordmark"}
          clipPath={`url(#${clip})`}
        >
          <image
            href={original}
            width="4096"
            height="1186"
            filter={`url(#${light})`}
          />
        </g>
      )}
    </svg>
  );
}
