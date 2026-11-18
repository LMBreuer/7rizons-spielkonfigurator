import { useSyncExternalStore } from "react";
import { translate } from "../supabase/functions/_shared/translations.js";
export const LANGUAGE_KEY = "7rizons:language:v1";
let language = "de";
try {
  if (localStorage.getItem(LANGUAGE_KEY) === "en") language = "en";
} catch {}
const listeners = new Set();
export const t = (text, values) => translate(text, language, values);
export const getLanguage = () => language;
export function setLanguage(next) {
  language = next === "en" ? "en" : "de";
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {}
  for (const listener of listeners) listener();
}
export function useLanguage() {
  return [
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getLanguage,
      () => "de",
    ),
    setLanguage,
  ];
}
