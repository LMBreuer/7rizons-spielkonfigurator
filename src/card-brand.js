import { useEffect, useSyncExternalStore } from "react";
import { CARD_GROUPS } from "../supabase/functions/_shared/card-groups.js";
import { cloud, unwrap } from "./cloud.js";

const local = import.meta.env?.DEV === true;
const localBase = (import.meta.env?.BASE_URL || "/") + "__card-originals/";
const fontFiles = [
  ["antonia-regular", "Rizons Antonia", { weight: "400" }],
  ["antonia-bold", "Rizons Antonia", { weight: "700" }],
  ["antonia-italic", "Rizons Antonia", { weight: "400", style: "italic" }],
  ["exo-2", "Rizons Exo", { weight: "100 900" }],
];

let cached;
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify() {
  for (const listener of listeners) listener();
}

function sourceFor(accountId) {
  return local ? "local" : cloud && accountId;
}

function releaseAssets(entry) {
  for (const font of entry.fonts) document.fonts.delete(font);
  for (const url of Object.values(entry.backs)) URL.revokeObjectURL(url);
}

export function resetOriginalCardAssets(accountId) {
  if (!cached || cached.source === sourceFor(accountId)) return;
  releaseAssets(cached);
  cached = undefined;
  notify();
}

async function readAsset(name) {
  if (!local) {
    return unwrap(await cloud.storage.from("card-originals").download(name));
  }
  const response = await fetch(localBase + name);
  if (!response.ok) throw new Error("Missing original card asset");
  return response.blob();
}

export function loadOriginalCardAssets(accountId) {
  resetOriginalCardAssets(accountId);
  const source = sourceFor(accountId);
  if (!source) return Promise.resolve(null);
  if (cached && cached.value !== null) return cached.promise;

  const entry = { source, fonts: [], backs: {}, value: undefined };
  cached = entry;
  entry.promise = (async () => {
    try {
      const [fonts, backs] = await Promise.all([
        Promise.all(
          fontFiles.map(async ([name, family, descriptors]) => {
            const file = await readAsset(name + (local ? "" : ".woff2"));
            return new FontFace(
              family,
              await file.arrayBuffer(),
              descriptors,
            ).load();
          }),
        ),
        Promise.all(
          Object.keys(CARD_GROUPS).map(async (group) => [
            group,
            await readAsset(group + ".jpg"),
          ]),
        ),
      ]);
      if (cached !== entry) return null;
      entry.backs = Object.fromEntries(
        backs.map(([group, file]) => [group, URL.createObjectURL(file)]),
      );
      await Promise.all(
        Object.values(entry.backs).map(async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
        }),
      );
      if (cached !== entry) return null;
      entry.fonts = fonts;
      for (const font of fonts) document.fonts.add(font);
      entry.value = entry.backs;
    } catch {
      if (cached === entry) {
        releaseAssets(entry);
        entry.value = null;
      }
    }
    if (cached !== entry) return null;
    notify();
    return entry.value;
  })();
  notify();
  return entry.promise;
}

export function useOriginalCardBacks(accountId) {
  const source = sourceFor(accountId);
  const backs = useSyncExternalStore(subscribe, () => {
    if (!source) return null;
    return cached?.source === source ? cached.value : undefined;
  });
  useEffect(() => {
    if (source) void loadOriginalCardAssets(accountId);
  }, [accountId, source]);
  return backs;
}
