import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BRAND_CARD_DESIGN,
  CARD_PRINT_FONT,
  CARD_PRINT_SIZES,
  cardPrintStyle,
  defaultBackColor,
  readCardStyle,
  CARD_PRINT_IMAGE_LIMIT,
  cardFontKey,
} from "../supabase/functions/_shared/card-print.js";
import {
  CardPrintFace,
  cardBackOverflows,
  cardTextOverflows,
  cardTitle,
} from "./CardPrintFaces.jsx";
import { printWorksheet } from "./WorksheetCards.jsx";
import CardGroupField from "./CardGroupField.jsx";
import {
  CARD_GROUPS,
  cardGroup,
} from "../supabase/functions/_shared/card-groups.js";
import {
  effectiveCardPrint,
  loadCardBrandPack,
  lockCardDesign,
  useCardBrandPack,
} from "./card-brand.js";

const CardEditor = React.lazy(() => import("./CardEditor.jsx"));
const fontLabels = {
  body: "Textgröße",
  title: "Titelgröße",
  type: "Kartentypgröße",
};

const designLabels = {
  [BRAND_CARD_DESIGN]: "7’rizons-Design",
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
  settings: rawSettings,
  onSettings,
  onCardGroup,
  onClose,
  t,
  language,
}) {
  const dialog = useRef(null);
  const packInput = useRef(null);
  const front = useRef(null);
  const back = useRef(null);
  const pendingImage = useRef(0);
  const brandPack = useCardBrandPack();
  const settings = effectiveCardPrint(rawSettings);
  const branded = settings.design === BRAND_CARD_DESIGN;
  const [selected, setSelected] = useState(cards[0]?.id);
  const [imageError, setImageError] = useState("");
  const [overflow, setOverflow] = useState(false);
  const [backOverflow, setBackOverflow] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [editingBack, setEditingBack] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState("");
  const card = cards.find((item) => item.id === selected) || cards[0];
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
    return () => {
      pendingImage.current++;
      element.close();
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      setOverflow(
        cardTextOverflows(front.current.querySelector(".deck-card-front")),
      );
      setBackOverflow(
        cardBackOverflows(back.current.querySelector(".deck-card-back")),
      );
    };
    measure();
    const resize =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    resize?.observe(front.current);
    resize?.observe(back.current);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      resize?.disconnect();
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [card, rawSettings, brandPack]);

  async function loadPack(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setPackLoading(true);
    setPackError("");
    try {
      await loadCardBrandPack(files);
    } catch (error) {
      setPackError(
        t(
          error.message ===
            "Bitte den vollständigen Ordner „7’rizons Assets“ wählen."
            ? error.message
            : "Der lokale Assetordner konnte nicht geladen werden.",
        ),
      );
    } finally {
      setPackLoading(false);
    }
  }

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
        {!branded && (
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
        )}
        {!branded && (
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
        )}
        {Object.entries(fontLabels).map(([name, label]) => (
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
        {!branded && (
          <div className="card-print-colors">
            <label>
              {t("Designfarbe vorne")}
              <input
                type="color"
                value={look.color}
                onChange={(event) => changeStyle({ color: event.target.value })}
              />
            </label>
            {settings.cardStyles?.[fontKey]?.color && (
              <button
                type="button"
                className="text-button"
                onClick={() => changeStyle({ color: undefined })}
              >
                {t("Kartenfarbe übernehmen")}
              </button>
            )}
          </div>
        )}
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
                {...{ card, settings, worksheetId, t, brandPack }}
                type={cardType(card)}
              />
            </figure>
            <figure ref={back}>
              <figcaption>
                {t("Rückseite")}{" "}
                <span>
                  {branded
                    ? `${new Intl.NumberFormat(language).format(97.7)} × ${new Intl.NumberFormat(language).format(71.6)} mm`
                    : settings.orientation === "portrait"
                      ? "63 × 88 mm"
                      : "88 × 63 mm"}
                </span>
              </figcaption>
              <CardPrintFace
                {...{ card, settings, worksheetId, t, brandPack }}
                type={cardType(card)}
                back
              />
            </figure>
          </div>
          <div className="card-print-design-options">
            {!lockCardDesign && (
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
            )}
            {branded && onCardGroup && (
              <CardGroupField
                className="card-print-design"
                card={card}
                onChange={(group) => onCardGroup(card.id, group)}
                t={t}
              />
            )}
          </div>
          {overflow && (
            <p className="card-print-warning" role="status">
              {t(
                "Der Text dieser Karte ist zu lang für das gewählte Format. Sie wird auf einem eigenen Bogen ausgegeben.",
              )}
            </p>
          )}
          {backOverflow && settings.includeBacks && (
            <p className="card-print-warning" role="status">
              {t(
                "Der Rückseitentext passt nicht auf die Karte und wird separat gedruckt. Die Kartenrückseiten zeigen das Logo.",
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
                    "--list-card-color": branded
                      ? CARD_GROUPS[cardGroup(item)].color
                      : cardPrintStyle(settings, worksheetId, item).color,
                  }}
                >
                  <strong>{cardTitle(item, t)}</strong>
                  <small>
                    {branded
                      ? t(CARD_GROUPS[cardGroup(item)].label)
                      : cardType(item)}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {branded ? (
        <div className="card-brand-pack">
          <input
            ref={packInput}
            type="file"
            webkitdirectory=""
            hidden
            onChange={loadPack}
          />
          <button
            type="button"
            className="button secondary"
            disabled={packLoading}
            onClick={() => packInput.current?.click()}
          >
            {t(
              brandPack ? "Assetordner wechseln" : "Lokalen Assetordner laden",
            )}
          </button>
          <small role="status">
            {t(
              brandPack
                ? "Originalschrift und Originalrückseiten geladen."
                : "Mit dem Assetordner verwendet der Druck die Originalschrift und die Originalrückseiten.",
            )}
          </small>
          {packError && (
            <p className="card-print-warning" role="alert">
              {packError}
            </p>
          )}
        </div>
      ) : (
        <details
          className="card-print-back-options"
          onToggle={(event) => setEditingBack(event.currentTarget.open)}
        >
          <summary>{t("Rückseite bearbeiten")}</summary>
          <div className="card-print-back-fields">
            {editingBack && (
              <div className="card-print-back-editor">
                <div className="card-field-label">
                  {t("Text auf der Rückseite")}
                </div>
                <React.Suspense fallback={null}>
                  <CardEditor
                    label={t("Text auf der Rückseite")}
                    t={t}
                    autoFocus={false}
                    value={settings.backText}
                    onChange={(backText) => set({ backText, back: "text" })}
                  />
                </React.Suspense>
              </div>
            )}
            <div className="card-print-colors">
              <label>
                {t("Designfarbe hinten")}
                <input
                  type="color"
                  value={settings.backColor || defaultBackColor(settings.paper)}
                  onChange={(event) => set({ backColor: event.target.value })}
                />
              </label>
              {settings.backColor && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => set({ backColor: "" })}
                >
                  {t("Standardfarbe übernehmen")}
                </button>
              )}
            </div>
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
      )}
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
          disabled={readingImage || packLoading}
          onClick={() => printWorksheet("cards")}
        >
          {t("Karten drucken")}
        </button>
      </footer>
    </dialog>
  );
}
