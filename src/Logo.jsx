import React from "react";
import original from "./assets/7rizons-logo.png";

// Render the original pixels inside a tight SVG viewport. The source PNG stays unchanged.
export default function Logo() {
  return (
    <svg
      className="brand-logo"
      viewBox="568 213 2757 759"
      role="img"
      aria-label="7’rizons"
    >
      <defs>
        <clipPath id="logo-wordmark-area">
          <rect x="1400" y="180" width="2000" height="850" />
        </clipPath>
        <filter id="logo-light-wordmark" x="0" y="0" width="100%" height="100%">
          <feFlood floodColor="#f2f6fc" />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
      <image href={original} width="4096" height="1186" />
      <g className="logo-dark-wordmark" clipPath="url(#logo-wordmark-area)">
        <image
          href={original}
          width="4096"
          height="1186"
          filter="url(#logo-light-wordmark)"
        />
      </g>
    </svg>
  );
}
