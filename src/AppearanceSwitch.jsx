import { t } from "./i18n.js";
import React from "react";

const choices = [
  ["light", "Hell"],
  ["dark", "Dunkel"],
  ["contrast", "Hoher Kontrast"],
];
export default function AppearanceSwitch({ value, onChange }) {
  return (
    <div
      className="appearance-switch"
      role="group"
      aria-label={t("Darstellung")}
    >
      {choices.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          aria-label={t(label)}
          title={t(label)}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {mode === "light" ? (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
              </>
            ) : mode === "dark" ? (
              <path d="M20 14A8.5 8.5 0 0 1 10 4 8.5 8.5 0 1 0 20 14Z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="8" />
                <path
                  d="M12 4a8 8 0 0 0 0 16Z"
                  fill="currentColor"
                  stroke="none"
                />
              </>
            )}
          </svg>
        </button>
      ))}
    </div>
  );
}
