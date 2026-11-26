import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CARD_PRINT_FONT,
  CARD_PRINT_IMAGE_LIMIT,
  cardFontKey,
} from "../supabase/functions/_shared/card-print.js";
import {
  CardPrintFace,
  cardTextOverflows,
  cardTitle,
} from "./CardPrintFaces.jsx";
import { printWorksheet } from "./WorksheetCards.jsx";

const designLabels = {
  minimal: "Minimalistisch",
  retro: "Retro",
  future: "Futuristisch",
  split: "Farbflächen",
  curve: "Farbbögen",
};

async function readCover(file) {
  const types = ["image/png", "image/jpeg", "image/webp"];
  if (!types.includes(file.type))
    throw new Error("Bitte ein PNG-, JPEG- oder WebP-Bild wählen.");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    for (const longest of [1200, 960, 720]) {
      const scale = Math.min(1, longest / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/webp", 0.86);
      if (result.length <= CARD_PRINT_IMAGE_LIMIT) return result;
    }
    throw new Error("Das Bild ist zu groß für die Projektsicherung.");
  } finally {
    image.close();
  }
}

export default function CardPrintEditor({
  cards,
  cardType,
  worksheetId,
  settings,
  onSettings,
  onClose,
  t,
  language,
}) {
  const dialog = useRef(null);
  const front = useRef(null);
  const pendingImage = useRef(0);
  const [selected, setSelected] = useState(cards[0]?.id);
  const [imageError, setImageError] = useState("");
  const [overflow, setOverflow] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const card = cards.find((item) => item.id === selected) || cards[0];
  const fontKey = cardFontKey(worksheetId, card.id);
  const fontSize = settings.fontSizes[fontKey] ?? CARD_PRINT_FONT;
  const set = (value) => onSettings((previous) => ({ ...previous, ...value }));
  function close() {
    dialog.current.close();
    onClose();
  }

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => {
      pendingImage.current++;
      element.close();
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () =>
      setOverflow(
        cardTextOverflows(front.current.querySelector(".deck-card-front")),
      );
    measure();
    const resize =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    resize?.observe(front.current);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      resize?.disconnect();
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [card, settings]);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const id = ++pendingImage.current;
    setReadingImage(true);
    setImageError("");
    try {
      const backImage = await readCover(file);
      if (pendingImage.current === id) set({ back: "image", backImage });
    } catch (error) {
      if (pendingImage.current === id)
        setImageError(
          t(
            error.message === "Bitte ein PNG-, JPEG- oder WebP-Bild wählen." ||
              error.message === "Das Bild ist zu groß für die Projektsicherung."
              ? error.message
              : "Das Bild konnte nicht geöffnet werden.",
          ),
        );
    } finally {
      if (pendingImage.current === id) setReadingImage(false);
    }
  }

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
      <div className="card-print-editor-options">
        <label>
          {t("Format")}
          <select
            value={settings.orientation}
            onChange={(e) => set({ orientation: e.target.value })}
          >
            <option value="portrait">{t("Hochformat")}</option>
            <option value="landscape">{t("Querformat")}</option>
          </select>
        </label>
        <label>
          {t("Kartenhintergrund")}
          <select
            value={settings.paper}
            onChange={(e) => set({ paper: e.target.value })}
          >
            <option value="white">{t("Weiß")}</option>
            <option value="cream">{t("Creme")}</option>
            <option value="dark">{t("Dunkel")}</option>
          </select>
        </label>
        <label className="card-font-control">
          <span>
            {t("Textgröße")}{" "}
            <output>
              {new Intl.NumberFormat(language).format(fontSize)} pt
            </output>
          </span>
          <input
            type="range"
            min="8"
            max="14"
            step="0.5"
            value={fontSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              onSettings((previous) => {
                const fontSizes = { ...previous.fontSizes };
                if (size === CARD_PRINT_FONT) delete fontSizes[fontKey];
                else fontSizes[fontKey] = size;
                return { ...previous, fontSizes };
              });
            }}
          />
        </label>
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
              <CardPrintFace
                {...{ card, settings, worksheetId, t }}
                type={cardType(card)}
              />
            </figure>
            <figure>
              <figcaption>
                {t("Rückseite")}{" "}
                <span>
                  {settings.orientation === "portrait"
                    ? "63 × 88 mm"
                    : "88 × 63 mm"}
                </span>
              </figcaption>
              <CardPrintFace
                {...{ card, settings, worksheetId, t }}
                type={cardType(card)}
                back
              />
            </figure>
          </div>
          <label className="card-print-design">
            {t("Kartendesign")}
            <select
              value={settings.design}
              onChange={(e) => set({ design: e.target.value })}
            >
              {Object.entries(designLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
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
                  style={{ "--list-card-color": item.color }}
                >
                  <strong>{cardTitle(item, t)}</strong>
                  <small>{cardType(item)}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <details className="card-print-back-options">
        <summary>{t("Rückseite bearbeiten")}</summary>
        <div className="card-print-back-fields">
          <label>
            {t("Text auf der Rückseite")}
            <textarea
              rows={2}
              maxLength={240}
              value={settings.backText}
              onChange={(e) => set({ backText: e.target.value, back: "text" })}
            />
          </label>
          <label>
            {t("Bild auf der Rückseite")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={readingImage}
              onChange={upload}
            />
          </label>
          {settings.backImage && (
            <button
              className="button secondary"
              type="button"
              onClick={() => set({ back: "text", backImage: "" })}
            >
              {t("Bild entfernen")}
            </button>
          )}
          {imageError && (
            <p className="card-print-warning" role="alert">
              {imageError}
            </p>
          )}
        </div>
      </details>
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
            {t("Beim beidseitigen Druck an der langen Kante wenden.")}
          </small>
        )}
        <button
          type="button"
          className="button"
          disabled={readingImage}
          onClick={() => printWorksheet("cards")}
        >
          {t("Karten drucken")}
        </button>
      </footer>
    </dialog>
  );
}
