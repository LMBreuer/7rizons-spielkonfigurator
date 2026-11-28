import React from "react";

const languages = [
  ["de", "Deutsch"],
  ["en", "English"],
];

export default function LanguageSwitch({ label, value, onChange, disabled, compact }) {
  return (
    <div className="language-switch" role="group" aria-label={label}>
      {languages.map(([code, name]) => (
        <button
          key={code}
          type="button"
          lang={code}
          disabled={disabled}
          aria-label={name}
          aria-pressed={value === code}
          onClick={() => onChange(code)}
        >
          {compact ? code.toUpperCase() : name}
        </button>
      ))}
    </div>
  );
}
