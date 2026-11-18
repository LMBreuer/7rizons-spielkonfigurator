import React from "react";
import { displayDate } from "../supabase/functions/_shared/fields.js";
import {
  MK,
  LE,
  SAFETY,
  NEXT,
  settingsOf,
} from "../supabase/functions/_shared/domain.js";
import { translate } from "../supabase/functions/_shared/translations.js";

const CardEditor = React.lazy(() => import("./CardEditor.jsx"));
function CardAnswer({ value }) {
  if (typeof value === "string") return value;
  return value.content.map((p, i) => (
    <p key={i}>
      {(p.content || []).map((r, j) => {
        let text = r.text;
        for (const m of r.marks || [])
          text = React.createElement(m.type, null, text);
        return <React.Fragment key={j}>{text}</React.Fragment>;
      })}
      {!p.content && <br />}
    </p>
  ));
}

export default function Worksheet({
  draft,
  result,
  settings,
  source,
  onAnswer,
}) {
  const language = draft.language || "de",
    t = (text) => translate(text, language);
  const overview = result.templateVariant === "overview";
  const guided = result.templateVariant === "guided";
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
      <div className="eyebrow">{t("7’rizons · Dein Seminar-Hack")}</div>
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
      <h2>{t("Lerntätigkeiten")}</h2>
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
                      <strong>{t("Beitrag zu deinen Lerntätigkeiten:")}</strong>{" "}
                      {m.learningContribution}
                    </p>
                    {!!m.cardExamples.length && (
                      <>
                        <h4>{t("Ideen für deine Karten")}</h4>
                        <ol>
                          {m.cardExamples.map((text, i) => (
                            <li key={i}>{text}</li>
                          ))}
                        </ol>
                      </>
                    )}
                    {m.guide && (
                      <div className="mechanism-guide">
                        <h4>{t("Arbeitsauftrag")}</h4>
                        <p>{m.guide.questions}</p>
                        <p>{m.guide.frame}</p>
                        <details className="no-print" key={result.requestId}>
                          <summary>
                            {t("Ausgefülltes Beispiel anzeigen")}
                          </summary>
                          <p>{m.guide.example}</p>
                        </details>
                      </div>
                    )}
                    <div className="writing-fields">
                      {Array.from(
                        { length: settingsOf(settings).cardsPerMechanism },
                        (_, i) => (
                          <div
                            className={
                              onAnswer
                                ? "writing-card editing-card"
                                : "writing-card"
                            }
                            key={i}
                          >
                            <h4>
                              {t(m.guide ? "Dein Entwurf" : "Eigene Karte")}{" "}
                              {i + 1}
                            </h4>
                            {onAnswer && (
                              <React.Suspense fallback={null}>
                                <CardEditor
                                  key={result.requestId}
                                  t={t}
                                  label={
                                    t(
                                      MK.find((x) => x.id === m.mechanismId)
                                        .label,
                                    ) +
                                    " · " +
                                    t("Dein Entwurf") +
                                    " " +
                                    (i + 1)
                                  }
                                  value={
                                    result.answers?.[m.mechanismId + "-" + i] ||
                                    ""
                                  }
                                  onChange={(value) =>
                                    onAnswer(m.mechanismId + "-" + i, value)
                                  }
                                />
                              </React.Suspense>
                            )}
                            {result.answers?.[m.mechanismId + "-" + i] ? (
                              <section className="card-answer">
                                <CardAnswer
                                  value={
                                    result.answers[m.mechanismId + "-" + i]
                                  }
                                />
                              </section>
                            ) : (
                              <>
                                <div />
                                <div />
                                <div />
                                <div />
                              </>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </>
                )}
              </section>
            ))}
          </React.Fragment>
        );
      })}
      <section>
        <h2>{t("Safety-Rahmen")}</h2>
        <p>{overview ? t(MK.find((m) => m.id === "m91").kurz) : t(SAFETY)}</p>
      </section>
      {!overview && (
        <section>
          <h2>{t(guided ? "Probelauf" : "Nächste Schritte")}</h2>
          <ul>
            {result.nextSteps.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
          <p>{t(NEXT)}</p>
        </section>
      )}
      <p className="provenance">
        {t(
          source?.kind === "template"
            ? "Aus deiner Auswahl mit festen Vorlagen erstellt."
            : "Mit KI ausgearbeitet · fachlich noch zu prüfen.",
        )}{" "}
        {source?.provider &&
          `${source.provider} · ${source.model || t("manueller Import")}`}{" "}
        {t(
          "· Spielkonfigurator by Harald Eckmüller · Webapp-Umsetzung unterstützt durch LMB",
        )}
      </p>
    </article>
  );
}
