import React, { useMemo } from "react";
import { displayDate } from "../supabase/functions/_shared/fields.js";
import {
  cardTypeKey,
  worksheetCards,
} from "../supabase/functions/_shared/card-text.js";
import WorksheetCards from "./WorksheetCards.jsx";
import { PrintableCards } from "./CardPrintFaces.jsx";
import { CARD_PRINT_DEFAULTS } from "../supabase/functions/_shared/card-print.js";
import Reflections from "./Reflections.jsx";
import Logo from "./Logo.jsx";
import { translate } from "../supabase/functions/_shared/translations.js";

import { catalogFor } from "../supabase/functions/_shared/content.js";

export default function Worksheet({
  draft,
  result,
  source,
  worksheetId,
  cardPrint = CARD_PRINT_DEFAULTS,
  cardPrintAccountId,
  screenHeader,
  screenLanguage,
  onAnswer,
  onCards,
  onCardType,
  onNotes,
  onReflections,
}) {
  const { LE, MK, blocks } = catalogFor(draft);
  const language = draft.language || "de",
    t = (text, values) => translate(text, language, values);
  const cards = useMemo(() => worksheetCards(result), [result]);
  const notes = result.notes || [];
  const mechanicName = (id) => t(MK.find((item) => item.id === id)?.label);
  const defaultType = (id) => mechanicName(id) || t("Spielkarte");
  const typeProps = (id) => ({
    defaultType: defaultType(id),
    customType: result.cardTypes?.[cardTypeKey(id)] || "",
    onCardType: onCardType ? (value) => onCardType(id, value) : undefined,
  });
  const overview = result.templateVariant === "overview";
  const guided = result.templateVariant === "guided";
  const playtestNotes = result.answers?.playtest;
  const blankPlaytestNotes = !playtestNotes?.trim() && !result.reflections?.length;
  const worksheetOrigin = (
    <>
      {t(
        source?.kind === "template"
          ? "Aus Ihrer Auswahl mit festen Vorlagen erstellt."
          : "Mit KI ausgearbeitet.",
      )}
      {source?.provider &&
        ` ${source.provider} · ${source.model || t("manueller Import")}`}
    </>
  );
  const isBase = (m) =>
    Boolean(
      MK.find((x) => x.id === m.mechanismId)?.basis &&
      !draft.priority?.promoted?.includes(m.mechanismId),
    );
  return (
    <article
      className={overview ? "worksheet worksheet-overview" : "worksheet"}
      id="worksheet"
      lang={language}
    >
      {screenHeader && (
        <div className="worksheet-screen-header no-print" lang={screenLanguage}>
          {screenHeader}
        </div>
      )}
      <div className="worksheet-print-brand">
        <Logo className="worksheet-print-logo" inverse={false} />
        <div>
          <strong>{t(overview ? "Übersicht" : "Arbeitsblatt")}</strong>
          <small>{worksheetOrigin}</small>
        </div>
      </div>
      <div className="eyebrow">{t("7’rizons · Ihr Seminar-Hack")}</div>
      <h1 tabIndex={-1}>{result.title}</h1>
      {result.introduction && <p className="intro">{result.introduction}</p>}
      <dl className="metadata">
        {Object.entries(draft.context)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>
                {t(
                  {
                    thema: "Thema",
                    fach: "Fach",
                    name: "Lehrveranstaltung",
                    dozent: "Dozent:in",
                    semester: "Semester",
                    datum: "Datum",
                  }[k],
                )}
              </dt>
              <dd>{k === "datum" ? displayDate(v) : v}</dd>
            </div>
          ))}
      </dl>
      <h2>{t("Lernerlebnisse")}</h2>
      <p>
        {draft.learning
          .map((id) => t(LE.find((l) => l.id === id)?.label))
          .join(" · ")}
      </p>
      {[false, true].map((base) => {
        const items = result.mechanisms.filter((m) => isBase(m) === base);
        if (!items.length) return null;
        return (
          <React.Fragment key={String(base)}>
            <h2 className="worksheet-category">
              {t(
                base ? "Basisspiel-Elemente gezielt nutzen" : "Neue Mechaniken",
              )}
            </h2>
            {items.map((m) => (
              <section className="worksheet-mechanism" key={m.mechanismId}>
                <h3>{t(MK.find((x) => x.id === m.mechanismId)?.label)}</h3>
                <p>{m.adaptation}</p>
                {!overview && (
                  <>
                    <p>
                      <strong>{t("Beitrag zu Ihren Lerntätigkeiten:")}</strong>{" "}
                      {m.learningContribution}
                    </p>
                    {!!m.cardExamples.length && (
                      <>
                        <h4>{t("Ideen für Ihre Karten")}</h4>
                        <ol>
                          {m.cardExamples.map((text, i) => (
                            <li key={i}>{text}</li>
                          ))}
                        </ol>
                      </>
                    )}
                    {m.guide &&
                      (m.guide.questions ||
                        m.guide.frame ||
                        m.guide.example) && (
                        <div className="mechanism-guide">
                          <h4>{t("Arbeitsauftrag")}</h4>
                          <p>{m.guide.questions}</p>
                          <p>{m.guide.frame}</p>
                          {m.guide.example && (
                            <details
                              className="no-print"
                              key={result.requestId}
                            >
                              <summary>
                                {t("Ausgefülltes Beispiel anzeigen")}
                              </summary>
                              <p>{m.guide.example}</p>
                            </details>
                          )}
                        </div>
                      )}
                    <WorksheetCards
                      cards={cards.filter(
                        (card) => card.mechanismId === m.mechanismId,
                      )}
                      notes={notes.filter(
                        (note) => note.mechanismId === m.mechanismId,
                      )}
                      onNotes={onNotes}
                      mechanicId={m.mechanismId}
                      {...typeProps(m.mechanismId)}
                      onCards={onCards}
                      t={t}
                    />
                  </>
                )}
              </section>
            ))}
          </React.Fragment>
        );
      })}
      {!overview &&
        !result.mechanisms.length &&
        (onCards || onNotes || cards.length > 0 || notes.length > 0) && (
          <section>
            <h2>{t("Eigene Spielkarten")}</h2>
            <WorksheetCards
              cards={cards}
              notes={notes}
              onNotes={onNotes}
              mechanicId={null}
              {...typeProps(null)}
              onCards={onCards}
              t={t}
            />
          </section>
        )}
      <section className="worksheet-safety">
        <h2>{t("Safety-Rahmen")}</h2>
        <p>
          {overview ? t(MK.find((m) => m.id === "m91").kurz) : t(blocks.safety)}
        </p>
      </section>
      {!overview && (
        <section className="worksheet-next">
          <h2>{t(guided ? "Probelauf" : "Nächste Schritte")}</h2>
          <ul>
            {result.nextSteps.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
          {guided && (onAnswer || playtestNotes?.trim() || blankPlaytestNotes) && (
            <section
              className={[
                "playtest-notes",
                blankPlaytestNotes && !onAnswer && "print-notes",
                !blankPlaytestNotes && !playtestNotes?.trim() && "no-print",
              ].filter(Boolean).join(" ")}
            >
              <h3>{t("Notizen zum Probelauf")}</h3>
              {onAnswer && (
                <label className="no-print">
                  <span className="sr-only">{t("Notizen zum Probelauf")}</span>
                  <textarea
                    rows={3}
                    maxLength={4000}
                    value={playtestNotes || ""}
                    onChange={(e) => onAnswer("playtest", e.target.value)}
                  />
                </label>
              )}
              {playtestNotes?.trim() ? (
                <p className={onAnswer ? "print-notes" : ""}>
                  {playtestNotes}
                </p>
              ) : blankPlaytestNotes ? (
                <div
                  className="worksheet-print-lines print-notes"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </section>
          )}
          <p>{t(blocks.closing)}</p>
        </section>
      )}
      {!overview && (
        <Reflections
          items={result.reflections || []}
          title={result.title}
          onChange={onReflections}
          t={t}
        />
      )}
      <p className="provenance">
        {worksheetOrigin}{" "}
        {t(
          "· Spielkonfigurator by Harald Eckmüller · Webapp-Umsetzung unterstützt durch LMB",
        )}
      </p>
      {cards.length > 0 && (
        <PrintableCards
          cards={cards}
          worksheetId={worksheetId}
          settings={cardPrint}
          accountId={cardPrintAccountId}
          t={t}
        />
      )}
    </article>
  );
}
