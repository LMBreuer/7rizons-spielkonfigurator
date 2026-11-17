import React from "react";
import {
  MK,
  LE,
  SAFETY,
  NEXT,
  settingsOf,
} from "../supabase/functions/_shared/domain.js";
export default function Worksheet({ draft, result, settings, source }) {
  return (
    <article className="worksheet" id="worksheet">
      <div className="eyebrow">7’rizons · Dein Seminar-Hack</div>
      <h1>{result.title}</h1>
      <p className="intro">{result.introduction}</p>
      <dl className="metadata">
        {Object.entries(draft.context)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>
                {
                  {
                    thema: "Thema",
                    fach: "Fach",
                    name: "Lehrveranstaltung",
                    dozent: "Dozent:in",
                    semester: "Semester",
                    datum: "Datum",
                  }[k]
                }
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <h2>Lerntätigkeiten</h2>
      <p>
        {draft.learning
          .map((id) => LE.find((l) => l.id === id)?.label)
          .join(" · ")}
      </p>
      {result.mechanisms.map((m, i) => (
        <section key={m.mechanismId}>
          <div className="eyebrow">
            {String(i + 1).padStart(2, "0")} ·{" "}
            {MK.find((x) => x.id === m.mechanismId)?.basis
              ? "Basisspiel gezielt nutzen"
              : "Neue Anpassung"}
          </div>
          <h2>{MK.find((x) => x.id === m.mechanismId)?.label}</h2>
          <p>{m.adaptation}</p>
          <p>
            <strong>Beitrag zu deinen Lerntätigkeiten:</strong>{" "}
            {m.learningContribution}
          </p>
          {!!m.cardExamples.length && (
            <>
              <h3>Ideen für deine Karten</h3>
              <ol>
                {m.cardExamples.map((t, n) => (
                  <li key={n}>{t}</li>
                ))}
              </ol>
            </>
          )}
          <div className="writing-fields">
            {Array.from(
              { length: settingsOf(settings).cardsPerMechanism },
              (_, n) => (
                <div className="writing-card" key={n}>
                  <h3>Eigene Karte {n + 1}</h3>
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              ),
            )}
          </div>
        </section>
      ))}
      <section>
        <h2>Safety-Rahmen</h2>
        <p>{SAFETY}</p>
      </section>
      <section>
        <h2>Nächste Schritte</h2>
        <ul>
          {result.nextSteps.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p>{NEXT}</p>
      </section>
      <p className="provenance">
        {source?.kind === "template"
          ? "Aus deiner Auswahl mit festen Vorlagen erstellt."
          : "Mit KI ausgearbeitet · fachlich noch zu prüfen."}{" "}
        {source?.provider &&
          `${source.provider} · ${source.model || "manueller Import"}`}{" "}
        · Created by Harald Eckmüller · Unterstützt von LMB
      </p>
    </article>
  );
}
