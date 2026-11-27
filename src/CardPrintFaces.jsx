import React, { useLayoutEffect, useRef, useState } from "react";
import {
  cardPrintStyle,
} from "../supabase/functions/_shared/card-print.js";
import {
  CARD_GROUPS,
  cardGroup,
} from "../supabase/functions/_shared/card-groups.js";
import {
  cardTextSections,
  plainCardText,
} from "../supabase/functions/_shared/card-text.js";
import { useOriginalCardBacks } from "./card-brand.js";
import CardAnswer from "./RichCardText.jsx";
import CardHeaderIcon from "./CardHeaderIcon.jsx";

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

export function CardPrintFace({ card, settings, worksheetId, backImage, style, t }) {
  const look = cardPrintStyle(settings, worksheetId, card);
  const group = cardGroup(card);
  const { label, color } = CARD_GROUPS[group];
  const groupLabel = t(label);
  return (
    <div
      className="deck-card-slot"
      data-orientation="landscape"
      data-design="rizons"
      style={style}
    >
      {backImage ? (
        <div className="deck-card deck-card-back">
          <img className="deck-card-cover" src={backImage} alt={groupLabel} />
        </div>
      ) : (
        <div
          className="deck-card deck-card-front"
          data-card-id={card.id}
          style={{
            "--card-color": color,
            "--card-accent-ink": accentInk(color),
            "--card-font-size": look.body,
            "--card-title-size": look.title,
            "--card-type-size": look.type,
          }}
        >
          <header className="deck-card-type">
            <CardHeaderIcon group={group} />
            <span>{groupLabel}</span>
          </header>
          {group === "inspiration" && card.title.trim() && (
            <div className="deck-card-title">{card.title.trim()}</div>
          )}
          <div className="deck-card-text">
            <BrandedCardText card={card} group={group} />
          </div>
        </div>
      )}
    </div>
  );
}

export function PrintableCards({ cards, worksheetId, settings, accountId, t }) {
  const backs = useOriginalCardBacks(accountId);
  const probe = useRef(null);
  const [oversized, setOversized] = useState([]);
  useLayoutEffect(() => {
    if (!probe.current) return;
    const next = [...probe.current.querySelectorAll(".deck-card-front")]
      .filter(cardTextOverflows)
      .map((node) => node.dataset.cardId);
    setOversized((old) => (old.join(":") === next.join(":") ? old : next));
  }, [cards, settings, backs]);

  if (!backs) return null;

  const perPage = 3;
  const fitting = cards.filter((card) => !oversized.includes(card.id));
  const batches = [];
  for (let index = 0; index < fitting.length; index += perPage) {
    batches.push(fitting.slice(index, index + perPage));
  }
  const face = (card, index, back = false) => (
    <CardPrintFace
      key={card.id}
      card={card}
      t={t}
      settings={settings}
      worksheetId={worksheetId}
      backImage={back ? backs[cardGroup(card)] : undefined}
      style={{ gridRow: back ? perPage - index : index + 1 }}
    />
  );

  return (
    <div className="card-print">
      <div className="card-print-measure" ref={probe}>
        {cards.map((card, index) => face(card, index))}
      </div>
      {batches.map((batch) => (
        <React.Fragment key={batch[0].id}>
          <div className="card-print-page" data-orientation="landscape">
            {batch.map((card, index) => face(card, index))}
          </div>
          {settings.includeBacks && (
            <div className="card-print-page" data-orientation="landscape">
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
              "--card-color": CARD_GROUPS[cardGroup(card)].color,
              "--extended-font-size": cardPrintStyle(settings, worksheetId, card).body + "pt",
            }}
          >
            <div>{t(CARD_GROUPS[cardGroup(card)].label)}</div>
            {cardGroup(card) === "inspiration" && card.title.trim() && (
              <h2>{card.title.trim()}</h2>
            )}
            <BrandedCardText card={card} group={cardGroup(card)} />
          </section>
        ))}
    </div>
  );
}
