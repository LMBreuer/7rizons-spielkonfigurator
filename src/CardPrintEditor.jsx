import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CARD_PRINT_FONT,
  CARD_PRINT_SIZES,
  cardPrintStyle,
  readCardStyle,
  cardFontKey,
} from "../supabase/functions/_shared/card-print.js";
import {
  CardPrintFace,
  cardTextOverflows,
  cardTitle,
} from "./CardPrintFaces.jsx";
import { printWorksheet } from "./WorksheetCards.jsx";
import CardGroupField from "./CardGroupField.jsx";
import {
  CARD_GROUPS,
  cardGroup,
} from "../supabase/functions/_shared/card-groups.js";
import { useOriginalCardBacks } from "./card-brand.js";

const fontLabels = {
  body: "Textgröße",
  title: "Titelgröße",
  type: "Kartentypgröße",
};

export default function CardPrintEditor({
  cards,
  worksheetId,
  settings: rawSettings,
  accountId,
  onSignIn,
  onSettings,
  onCardGroup,
  onClose,
  t,
  language,
}) {
  const dialog = useRef(null);
  const front = useRef(null);
  const backs = useOriginalCardBacks(accountId);
  const settings = rawSettings;
  const [selected, setSelected] = useState(cards[0]?.id);
  const [overflow, setOverflow] = useState(false);
  const card = cards.find((item) => item.id === selected) || cards[0];
  const fontControls = Object.entries(fontLabels).filter(
    ([name]) => name !== "title" || cardGroup(card) === "inspiration",
  );
  const fontKey = cardFontKey(worksheetId, card.id);
  const look = cardPrintStyle(settings, worksheetId, card);
  const set = (value) => onSettings((previous) => ({ ...previous, ...value }));
  function changeStyle(update) {
    onSettings((previous) => {
      const cardStyles = { ...previous.cardStyles };
      const style = readCardStyle({ ...cardStyles[fontKey], ...update });
      if (Object.keys(style).length) cardStyles[fontKey] = style;
      else delete cardStyles[fontKey];
      return { ...previous, cardStyles };
    });
  }

  function changeFont(name, size) {
    if (name !== "body") {
      changeStyle({ [name]: size });
      return;
    }
    onSettings((previous) => {
      const fontSizes = { ...previous.fontSizes };
      if (size === CARD_PRINT_FONT) delete fontSizes[fontKey];
      else fontSizes[fontKey] = size;
      return { ...previous, fontSizes };
    });
  }
  function close() {
    dialog.current.close();
    onClose();
  }

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useLayoutEffect(() => {
    const frame = front.current;
    if (!frame) return;
    const measure = () =>
      setOverflow(cardTextOverflows(frame.querySelector(".deck-card-front")));
    measure();
    const resize =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    resize?.observe(frame);
    return () => resize?.disconnect();
  }, [card, rawSettings, backs]);

  return (
    <dialog
      className="card-print-editor no-print"
      ref={dialog}
      aria-labelledby="card-print-editor-title"
      lang={language}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="card-print-editor-heading">
        <h2 id="card-print-editor-title">{t("Kartendruck")}</h2>
        <button
          type="button"
          className="button secondary card-print-close"
          aria-label={t("Schließen")}
          onClick={close}
        >
          <span>{t("Schließen")}</span>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {backs ? (
        <>
          <div className="card-print-editor-options">
            {fontControls.map(([name, label]) => (
              <label className="card-font-control" key={name}>
                <span>
                  {t(label)}{" "}
                  <output>
                    {new Intl.NumberFormat(language).format(look[name])} pt
                  </output>
                </span>
                <input
                  type="range"
                  aria-label={t(label)}
                  min={CARD_PRINT_SIZES[name].min}
                  max={CARD_PRINT_SIZES[name].max}
                  step="0.5"
                  value={look[name]}
                  onChange={(event) => changeFont(name, Number(event.target.value))}
                />
              </label>
            ))}
          </div>
          <div className="card-print-editor-workspace">
            <label className="card-print-compact-list">
              {t("Karten im Arbeitsblatt")}
              <select value={card.id} onChange={(e) => setSelected(e.target.value)}>
                {cards.map((item) => (
                  <option key={item.id} value={item.id}>
                    {cardTitle(item, t)}
                  </option>
                ))}
              </select>
            </label>
            <div className="card-print-stage">
              <div className="card-print-spread">
                <figure ref={front}>
                  <figcaption>{t("Vorderseite")}</figcaption>
                  <CardPrintFace {...{ card, settings, worksheetId, t }} />
                </figure>
                <figure>
                  <figcaption>
                    {t("Rückseite")} <span>88 × 63 mm</span>
                  </figcaption>
                  <CardPrintFace
                    {...{ card, settings, worksheetId, t }}
                    backImage={backs[cardGroup(card)]}
                  />
                </figure>
              </div>
              {onCardGroup && (
                <CardGroupField
                  className="card-print-design"
                  card={card}
                  onChange={(group) => onCardGroup(card.id, group)}
                  t={t}
                />
              )}
              {overflow && (
                <p className="card-print-warning" role="status">
                  {t(
                    "Der Text dieser Karte ist zu lang für das gewählte Format. Sie wird auf einem eigenen Bogen ausgegeben.",
                  )}
                </p>
              )}
            </div>
            <section
              className="card-print-card-list"
              aria-labelledby="card-print-list-title"
            >
              <h3 id="card-print-list-title">{t("Karten im Arbeitsblatt")}</h3>
              <ul>
                {cards.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={item.id === card.id}
                      onClick={() => setSelected(item.id)}
                      style={{
                        "--list-card-color": CARD_GROUPS[cardGroup(item)].color,
                      }}
                    >
                      <strong>{cardTitle(item, t)}</strong>
                      <small>{t(CARD_GROUPS[cardGroup(item)].label)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <footer className="card-print-editor-actions">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.includeBacks}
                onChange={(e) => set({ includeBacks: e.target.checked })}
              />
              {t("Rückseiten mitdrucken")}
            </label>
            {settings.includeBacks && (
              <small>
                {t("Beim beidseitigen Druck an der kurzen Kante wenden.")}
              </small>
            )}
            <button
              type="button"
              className="button"
              onClick={() => printWorksheet("cards", undefined, accountId)}
            >
              {t("Karten drucken")}
            </button>
          </footer>
        </>
      ) : (
        <div className="actions">
          <p className="card-print-warning" role="status">
            {backs === undefined
              ? t("Das 7’rizons-Originaldesign wird geladen …")
              : onSignIn
                ? t("Für den Kartendruck bitte anmelden.")
                : t("Die Originalschriften und Rückseiten sind für diese Installation nicht verfügbar.")}
          </p>
          {onSignIn && (
            <button type="button" className="button secondary" onClick={onSignIn}>
              {t("Anmelden")}
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}
