import React, { useLayoutEffect, useRef, useState } from "react";
import {
  cardPrintStyle,
  defaultBackColor,
} from "../supabase/functions/_shared/card-print.js";
import CardAnswer from "./RichCardText.jsx";
import Logo from "./Logo.jsx";

export function cardTitle(card, t) {
  return card.title.trim() || t("Spielkarte");
}

function accentInk(hex) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)
    .map((value) => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000" : "#fff";
}

export function cardBackOverflows(face) {
  const text = face?.querySelector(".deck-card-back-text");
  if (!text || !face.clientHeight) return false;
  const inner = face.querySelector(".deck-card-back-center");
  const boundary = face.getBoundingClientRect();
  const content = inner.getBoundingClientRect();
  const inset = face.closest('[data-design="curve"]')
    ? boundary.height * 0.17
    : parseFloat(getComputedStyle(face).paddingTop);
  return (
    content.top < boundary.top + inset - 1 ||
    content.bottom > boundary.bottom - inset + 1
  );
}

export function cardTextOverflows(face) {
  const text = face?.querySelector(".deck-card-text");
  if (!text || !text.clientWidth) return false;
  return (
    text.scrollHeight > text.clientHeight + 1 ||
    face.scrollHeight > face.clientHeight + 1
  );
}

export function CardPrintFace({
  card,
  type,
  settings,
  worksheetId,
  back = false,
  style,
  t,
}) {
  const look = cardPrintStyle(settings, worksheetId, card);
  const longType =
    [...type].length * look.type >
    (settings.orientation === "landscape" ? 245 : 340);
  const dark = settings.paper === "dark";
  return (
    <div
      className="deck-card-slot"
      data-orientation={settings.orientation}
      data-design={settings.design}
      data-paper={settings.paper}
      style={
        back
          ? {
              ...style,
              "--deck-back-accent":
                settings.backColor || defaultBackColor(settings.paper),
            }
          : style
      }
    >
      {back ? (
        <div className="deck-card deck-card-back" data-cover={settings.back}>
          {settings.back === "image" ? (
            <>
              <img
                className="deck-card-cover"
                src={settings.backImage}
                alt={t("Bild auf der Rückseite")}
              />
              <div className="deck-card-signature">
                <Logo className="deck-card-logo" inverse={false} />
              </div>
            </>
          ) : (
            <div className="deck-card-back-center">
              <Logo className="deck-card-logo" inverse={dark} />
              {settings.backText && (
                <div className="deck-card-back-text">
                  <CardAnswer value={settings.backText} />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="deck-card deck-card-front"
          data-card-id={card.id}
          data-long-type={longType || undefined}
          style={{
            "--card-color": look.color,
            "--card-accent-ink": accentInk(look.color),
            "--card-font-size": look.body,
            "--card-title-size": look.title,
            "--card-type-size": look.type,
          }}
        >
          <span className="deck-card-frame" aria-hidden="true" />
          <span className="deck-card-mark" aria-hidden="true">
            {type[0]}
          </span>
          <span
            className="deck-card-mark deck-card-mark-inverted"
            aria-hidden="true"
          >
            {type[0]}
          </span>
          <div className="deck-card-title">{cardTitle(card, t)}</div>
          <div className="deck-card-text">
            <CardAnswer value={card.text} />
          </div>
          <div className="deck-card-type">{type}</div>
        </div>
      )}
    </div>
  );
}

export function PrintableCards({ cards, cardType, worksheetId, settings, t }) {
  const probe = useRef(null);
  const [oversized, setOversized] = useState([]);
  const [backTooLong, setBackTooLong] = useState(false);
  useLayoutEffect(() => {
    function measure() {
      const next = [...probe.current.querySelectorAll(".deck-card-front")]
        .filter(cardTextOverflows)
        .map((node) => node.dataset.cardId);
      setOversized((old) => (old.join(":") === next.join(":") ? old : next));
      setBackTooLong(
        cardBackOverflows(probe.current.querySelector(".deck-card-back")),
      );
    }
    measure();
    // The print faces have a fixed size, but the browser can finish loading fonts after layout.
    document.fonts?.addEventListener("loadingdone", measure);
    return () => document.fonts?.removeEventListener("loadingdone", measure);
  }, [cards, settings, cardType]);

  const columns = settings.orientation === "portrait" ? 2 : 1;
  const perPage = columns === 2 ? 4 : 3;
  const fitting = cards.filter((card) => !oversized.includes(card.id));
  const batches = [];
  for (let index = 0; index < fitting.length; index += perPage) {
    batches.push(fitting.slice(index, index + perPage));
  }
  const face = (card, index, back, measure = false) => (
    <CardPrintFace
      key={card.id + (back ? "-back" : "")}
      card={card}
      type={cardType(card)}
      t={t}
      settings={
        back && backTooLong && !measure
          ? { ...settings, backText: "" }
          : settings
      }
      worksheetId={worksheetId}
      back={back}
      style={{
        gridColumn: back ? columns - (index % columns) : (index % columns) + 1,
        gridRow: Math.floor(index / columns) + 1,
      }}
    />
  );

  return (
    <div className="card-print">
      <div className="card-print-measure" ref={probe}>
        {cards.map((card, index) => face(card, index, false))}
        {settings.includeBacks &&
          settings.back === "text" &&
          settings.backText &&
          face(cards[0], 0, true, true)}
      </div>
      {batches.map((batch) => (
        <React.Fragment key={batch[0].id}>
          <div
            className="card-print-page"
            data-orientation={settings.orientation}
          >
            {batch.map((card, index) => face(card, index, false))}
          </div>
          {settings.includeBacks && (
            <div
              className="card-print-page"
              data-orientation={settings.orientation}
            >
              {batch.map((card, index) => face(card, index, true))}
            </div>
          )}
        </React.Fragment>
      ))}
      {cards
        .filter((card) => oversized.includes(card.id))
        .map((card) => (
          <section
            className="card-print-page card-print-extended"
            key={card.id}
            style={{
              "--card-color": cardPrintStyle(settings, worksheetId, card).color,
              "--extended-font-size":
                cardPrintStyle(settings, worksheetId, card).body + "pt",
            }}
          >
            <div>{cardType(card)}</div>
            <h2>{cardTitle(card, t)}</h2>
            <CardAnswer value={card.text} />
          </section>
        ))}
      {settings.includeBacks && backTooLong && (
        <section
          className="card-print-page card-print-extended"
          style={{
            "--card-color":
              settings.backColor || defaultBackColor(settings.paper),
            "--extended-font-size": "10.5pt",
          }}
        >
          <h2>{t("Text auf der Rückseite")}</h2>
          <CardAnswer value={settings.backText} />
        </section>
      )}
    </div>
  );
}
