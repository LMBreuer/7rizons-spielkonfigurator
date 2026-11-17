// Bonner Semestergrenzen: Winter 01.10.–31.03., Sommer 01.04.–30.09.
// https://www.uni-bonn.de/de/studium/studienverlauf/semestertermine
export function semesterOptions(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  let year = Number(parts.find((p) => p.type === "year").value);
  const month = Number(parts.find((p) => p.type === "month").value);
  let winter = month >= 10 || month <= 3;
  if (month <= 3) year--;
  return Array.from({ length: 10 }, () => {
    const value = winter
      ? `WS ${year}/${String(year + 1).slice(-2)}`
      : `SoSe ${year}`;
    if (winter) {
      year++;
      winter = false;
    } else winter = true;
    return value;
  });
}
export function dateInputValue(value = "") {
  let parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) {
    const old = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
    if (!old) return "";
    parts = [old[0], old[3], old[2].padStart(2, "0"), old[1].padStart(2, "0")];
  }
  const [, year, month, day] = parts;
  const check = new Date(0);
  check.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  if (
    Number(year) < 1 ||
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() !== Number(month) - 1 ||
    check.getUTCDate() !== Number(day)
  )
    return "";
  return `${year}-${month}-${day}`;
}
export function displayDate(value = "") {
  const date = dateInputValue(value);
  if (!date) return value;
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}
export function reordered(items, source, target, after = false) {
  if (source === target || !items.includes(source) || !items.includes(target))
    return items;
  const next = items.filter((id) => id !== source);
  next.splice(next.indexOf(target) + Number(after), 0, source);
  return next.every((id, i) => id === items[i]) ? items : next;
}
