import React, { useLayoutEffect, useRef, useState } from "react";
import {
  BRAND_CARD_DESIGN,
  cardPrintStyle,
  defaultBackColor,
} from "../supabase/functions/_shared/card-print.js";
import {
  CARD_GROUPS,
  cardGroup,
} from "../supabase/functions/_shared/card-groups.js";
import {
  cardTextSections,
  plainCardText,
} from "../supabase/functions/_shared/card-text.js";
import { effectiveCardPrint, useCardBrandPack } from "./card-brand.js";
import CardAnswer, { GameCardText } from "./RichCardText.jsx";
import CardHeaderIcon from "./CardHeaderIcon.jsx";
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

const introductionLabels =
  /^(Einleitung(?:stext)?|Situation|Introduction|Context):?$/i;
const instructionLabels =
  /^(Aufforderung|Anweisung|Arbeitsauftrag|Aufgabe|Instruction|Prompt|Task):?$/i;

function withoutSectionHeading(value, label) {
  if (typeof value === "string") return value;
  const [first, ...rest] = value.content;
  if (first.type !== "heading" || !label.test(plainCardText(first).trim()))
    return value;
  return rest.length ? { type: "doc", content: rest } : "";
}

function BrandedCardText({ card, group }) {
  const { introduction, instruction } = cardTextSections(card);
  const intro = withoutSectionHeading(introduction, introductionLabels);
  const prompt = withoutSectionHeading(instruction, instructionLabels);
  const opening = intro || (group !== "inspiration" ? card.title.trim() : "");
  return (
    <>
      {opening && (
        <div className="deck-card-introduction">
          <CardAnswer
            plainHeadings={group !== "inspiration"}
            value={opening}
          />
        </div>
      )}
      {prompt && (
        <div className="deck-card-instruction">
          <CardAnswer
            plainHeadings={group !== "inspiration"}
            value={prompt}
          />
        </div>
      )}
    </>
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
  brandPack,
}) {
  const look = cardPrintStyle(settings, worksheetId, card);
  const branded = settings.design === BRAND_CARD_DESIGN;
  const group = cardGroup(card);
  const { label, color } = CARD_GROUPS[group];
  const groupLabel = t(label);
  const originalBack = brandPack?.backs[group];
  const longType =
    [...type].length * look.type >
    (settings.orientation === "landscape" ? 245 : 340);
  const dark = settings.paper === "dark";
  const colorToPrint = branded ? color : look.color;
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
              "--deck-back-accent": branded
                ? color
                : settings.backColor || defaultBackColor(settings.paper),
            }
          : style
      }
    >
      {back ? (
        <div className="deck-card deck-card-back" data-cover={settings.back}>
          {branded ? (
            originalBack ? (
              <img
                className="deck-card-cover"
                src={originalBack}
                alt={groupLabel}
              />
            ) : (
              <div className="deck-card-back-center">
                <img
                  className="deck-brand-symbol"
                  src={(import.meta.env?.BASE_URL || "./") + "favicon.svg"}
                  alt=""
                />
                <strong className="deck-brand-name">{groupLabel}</strong>
              </div>
            )
          ) : settings.back === "image" ? (
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
            "--card-color": colorToPrint,
            "--card-accent-ink": accentInk(colorToPrint),
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
          {branded && (
            <header className="deck-card-type">
              <CardHeaderIcon group={group} />
              <span>{groupLabel}</span>
            </header>
          )}
          {(!branded || (group === "inspiration" && card.title.trim())) && (
            <div className="deck-card-title">{cardTitle(card, t)}</div>
          )}
          <div className="deck-card-text">
            {branded ? (
              <BrandedCardText card={card} group={group} />
            ) : (
              <GameCardText card={card} />
            )}
          </div>
          {!branded && <div className="deck-card-type">{type}</div>}
        </div>
      )}
    </div>
  );
}

export function PrintableCards({
  cards,
  cardType,
  worksheetId,
  settings: rawSettings,
  t,
}) {
  const brandPack = useCardBrandPack();
  const settings = effectiveCardPrint(rawSettings);
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
  }, [cards, rawSettings, cardType, brandPack]);

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
      brandPack={brandPack}
      settings={
        back && backTooLong && !measure
          ? { ...settings, backText: "" }
          : settings
      }
      worksheetId={worksheetId}
      back={back}
      style={{
        gridColumn: back ? columns - (index % columns) : (index % columns) + 1,
        gridRow:
          back && settings.orientation === "landscape"
            ? perPage - index
            : Math.floor(index / columns) + 1,
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
            data-design={settings.design}
          >
            {batch.map((card, index) => face(card, index, false))}
          </div>
          {settings.includeBacks && (
            <div
              className="card-print-page"
              data-orientation={settings.orientation}
              data-design={settings.design}
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
              "--card-color":
                settings.design === BRAND_CARD_DESIGN
                  ? CARD_GROUPS[cardGroup(card)].color
                  : cardPrintStyle(settings, worksheetId, card).color,
              "--extended-font-size":
                cardPrintStyle(settings, worksheetId, card).body + "pt",
            }}
          >
            <div>
              {settings.design === BRAND_CARD_DESIGN
                ? t(CARD_GROUPS[cardGroup(card)].label)
                : cardType(card)}
            </div>
            <h2>{cardTitle(card, t)}</h2>
            <GameCardText card={card} />
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
