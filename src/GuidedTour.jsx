import React, { useLayoutEffect, useRef } from "react";
import { t } from "./i18n.js";

export function TourButton({ onClick, disabled }) {
  return (
    <button type="button" className="tour-start no-print" disabled={disabled} onClick={onClick}>
      <span aria-hidden="true">?</span>
      {t("Kurztour")}
    </button>
  );
}

const edge = 12;
const gap = 16;

function placeCard(card, target, width, height) {
  const clamp = (value, limit) => Math.max(edge, Math.min(value, limit - edge));
  const maxLeft = width - card.offsetWidth;
  const maxTop = height - card.offsetHeight;
  const centeredTop = target.top + (target.height - card.offsetHeight) / 2;
  let left = target.left;
  let top = target.bottom + gap;
  if (target.right + gap <= maxLeft - edge) {
    left = target.right + gap;
    top = centeredTop;
  } else if (target.left - gap - card.offsetWidth >= edge) {
    left = target.left - gap - card.offsetWidth;
    top = centeredTop;
  } else if (
    top > maxTop - edge &&
    target.top - gap - card.offsetHeight >= edge
  ) {
    top = target.top - gap - card.offsetHeight;
  }
  card.style.left = `${clamp(left, maxLeft)}px`;
  card.style.top = `${clamp(top, maxTop)}px`;
}

function keepTourFocus(event) {
  if (event.key !== "Tab") return;
  const buttons = event.currentTarget.querySelectorAll("button");
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (event.shiftKey && (event.target === first || event.target.tabIndex === -1)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && event.target === last) {
    event.preventDefault();
    first.focus();
  }
}

export default function GuidedTour({
  steps,
  index,
  onChange,
  onClose,
  returnFocus,
}) {
  const dialogRef = useRef(null);
  const cardRef = useRef(null);
  const outlineRef = useRef(null);
  const titleRef = useRef(null);
  const step = steps[index];

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => {
      dialog.close();
      if (returnFocus?.isConnected && !returnFocus.disabled) {
        returnFocus.focus({ preventScroll: true });
        return;
      }
      const main = document.getElementById("main-content");
      const heading = main?.querySelector("h1") || main;
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    };
  }, [returnFocus]);

  useLayoutEffect(() => {
    const target =
      document.querySelector(`[data-tour="${step.target}"]`) ||
      (step.fallbackTarget &&
        document.querySelector(`[data-tour="${step.fallbackTarget}"]`));
    const menu = step.reveal ? target?.closest("details") : null;
    const wasOpen = menu?.open;
    if (menu) menu.open = true;

    const card = cardRef.current;
    const outline = outlineRef.current;
    const position = () => {
      const rect = target?.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      if (!rect?.width || !rect.height || rect.bottom <= 0 || rect.top >= height) {
        outline.hidden = true;
        card.style.left = "";
        card.style.top = "";
        card.classList.add("tour-centered");
        return;
      }
      outline.hidden = false;
      card.classList.remove("tour-centered");
      outline.style.left = `${rect.left}px`;
      outline.style.top = `${rect.top}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
      placeCard(card, rect, width, height);
    };
    const initial = target?.getBoundingClientRect();
    if (
      initial &&
      (initial.top < edge || initial.bottom > window.innerHeight - edge)
    ) {
      target.scrollIntoView({ block: "center", behavior: "instant" });
    }
    position();
    titleRef.current.focus({ preventScroll: true });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(position) : null;
    observer?.observe(card);
    if (target) observer?.observe(target);
    return () => {
      if (menu) menu.open = wasOpen;
      observer?.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [step]);

  const last = index === steps.length - 1;
  return (
    <dialog
      className="guided-tour no-print"
      ref={dialogRef}
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
      onKeyDown={keepTourFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="tour-outline" aria-hidden="true" ref={outlineRef} hidden />
      <div className="tour-card" ref={cardRef}>
        <header className="tour-card-header">
          <progress
            className="tour-progress"
            value={index + 1}
            max={steps.length}
            aria-label={t("Schritt {0} von {1}", {
              0: index + 1,
              1: steps.length,
            })}
          />
          <span aria-hidden="true">{index + 1} / {steps.length}</span>
          <button className="tour-close" aria-label={t("Tour schließen")} onClick={onClose}>
            ×
          </button>
        </header>
        <h2 id="tour-title" ref={titleRef} tabIndex={-1}>
          {t(step.title)}
        </h2>
        <p id="tour-description">{t(step.text)}</p>
        <footer className="tour-actions">
          {index > 0 && (
            <button className="button secondary" onClick={() => onChange(index - 1)}>
              {t("Zurück")}
            </button>
          )}
          <button
            className="button"
            onClick={last ? onClose : () => onChange(index + 1)}
          >
            {last ? t("Fertig") : t("Weiter")}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
