import React, { useEffect, useRef, useState } from "react";
import { t } from "./i18n.js";

export default function WorksheetExport({ text, onClose }) {
  const dialog = useRef(null);
  const field = useRef(null);
  const [status, setStatus] = useState("");
  const [shareFile] = useState(() => {
    if (!navigator.canShare || !navigator.share) return null;
    const file = new File([text], "7rizons-arbeitsblatt.txt", {
      type: "text/plain",
    });
    return navigator.canShare({ files: [file] }) ? file : null;
  });

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t("Text kopiert."));
    } catch {
      field.current?.focus();
      field.current?.select();
      setStatus(t("Der Text ist markiert. Kopieren Sie ihn über das Menü Ihres Geräts."));
    }
  }

  async function share() {
    setStatus("");
    try {
      await navigator.share({ files: [shareFile] });
    } catch (error) {
      if (error.name !== "AbortError")
        setStatus(t("Die Datei konnte nicht geteilt werden. Sie können den Text kopieren."));
    }
  }

  return (
    <dialog
      ref={dialog}
      className="project-import-dialog no-print"
      aria-labelledby="worksheet-export-title"
      onClose={onClose}
    >
      <h2 id="worksheet-export-title">{t("Arbeitsblatt als Markdown")}</h2>
      <textarea
        ref={field}
        aria-label={t("Markdown")}
        readOnly
        rows={9}
        value={text}
      />
      <p role="status" className="muted">{status}</p>
      <div className="actions">
        <button type="button" className="button" onClick={copy}>
          {t("Text kopieren")}
        </button>
        {shareFile && (
          <button type="button" className="button secondary" onClick={share}>
            {t("Textdatei teilen")}
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          onClick={() => dialog.current.close()}
        >
          {t("Schließen")}
        </button>
      </div>
    </dialog>
  );
}
