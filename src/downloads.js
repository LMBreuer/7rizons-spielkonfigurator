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
