export function jsonFilename(
  topic = "",
  kind = "konfiguration",
  now = new Date(),
) {
  const cleaned = topic
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const name = Array.from(cleaned).slice(0, 60).join("").replace(/-+$/, "");
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  const timestamp = `${part("year")}-${part("month")}-${part("day")}_${part("hour")}-${part("minute")}-${part("second")}`;
  const category = ["abgabe", "karten", "kartenvorlage"].includes(kind)
    ? kind
    : "konfiguration";
  return `7rizons-${category}${name ? "_" + name : ""}_${timestamp}.json`;
}

export function download(text, name, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Mobile download prompts can keep the file URL waiting for confirmation.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
