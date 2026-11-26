import { t, getLanguage } from "./i18n.js";
import React, { useState } from "react";
import {
  semesterOptions,
  dateInputValue,
} from "../supabase/functions/_shared/fields.js";

export default function ContextField({
  name,
  label,
  placeholder,
  value,
  onChange,
}) {
  const [options] = useState(semesterOptions);
  const [custom, setCustom] = useState(
    () => name === "semester" && !!value && !options.includes(value),
  );
  const id = `context-${name}`;
  if (name === "semester") {
    const other = custom || (!!value && !options.includes(value));
    return (
      <div>
        <label htmlFor={id}>
          {t(label)}
          <select
            id={id}
            value={other ? "custom" : value}
            onChange={(e) => {
              if (e.target.value === "custom") {
                setCustom(true);
                if (options.includes(value)) onChange("");
              } else {
                setCustom(false);
                onChange(e.target.value);
              }
            }}
          >
            <option value="">{t("Keine Angabe")}</option>
            {options.map((s, i) => (
              <option key={s} value={s}>
                {getLanguage() === "en"
                  ? s
                      .replace(/^WS /, "Winter semester ")
                      .replace(/^SoSe /, "Summer semester ")
                  : s}
                {i === 0 ? t(" · aktuell") : ""}
              </option>
            ))}
            <option value="custom">{t("Anderes Semester …")}</option>
          </select>
        </label>
        {other && (
          <label htmlFor={`${id}-custom`}>
            {t("Anderes Semester ")}
            <input
              id={`${id}-custom`}
              maxLength={1500}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
        )}
      </div>
    );
  }
  if (name === "datum") {
    const iso = dateInputValue(value);
    return (
      <div>
        <label htmlFor={id}>
          {t(label)}
          <input
            id={id}
            type="date"
            value={iso}
            aria-describedby={value && !iso ? `${id}-legacy` : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        {value && !iso && (
          <p className="muted" id={`${id}-legacy`}>
            {t("Gespeicherte Angabe: ")}
            {value}
            {t(". Wählen Sie ein Datum, um sie zu ersetzen. ")}
          </p>
        )}
      </div>
    );
  }
  return (
    <label className={name === "thema" ? "wide" : ""} htmlFor={id}>
      {t(label)}
      <input
        id={id}
        required={name === "thema"}
        maxLength={1500}
        value={value}
        placeholder={t(placeholder)}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
