// Programmatic focus still follows navigation for screen readers. Its visible
// ring is shown only after keyboard input, never after a pointer click.
export function trackInputMethod(doc = document) {
  doc.documentElement.dataset.input = "pointer";
  const keyboard = (event) => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey)
      doc.documentElement.dataset.input = "keyboard";
  };
  const pointer = () => {
    doc.documentElement.dataset.input = "pointer";
  };
  doc.addEventListener("keydown", keyboard, true);
  doc.addEventListener("pointerdown", pointer, true);
  return () => {
    doc.removeEventListener("keydown", keyboard, true);
    doc.removeEventListener("pointerdown", pointer, true);
  };
}
