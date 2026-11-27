import React from "react";
import {
  CARD_GROUPS,
  cardGroup,
} from "../supabase/functions/_shared/card-groups.js";

export default function CardGroupField({ card, onChange, t, className }) {
  const automatic =
    CARD_GROUPS[cardGroup({ mechanismId: card.mechanismId })].label;
  return (
    <label className={className}>
      {t("Kartengruppe / Rückseite")}
      <select
        value={card.group || ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">{t("Automatisch · {0}", { 0: t(automatic) })}</option>
        {Object.entries(CARD_GROUPS).map(([id, { label }]) => (
          <option key={id} value={id}>
            {t(label)}
          </option>
        ))}
      </select>
    </label>
  );
}
