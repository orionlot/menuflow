"use client";

import type { KItem } from "./KitchenClient";
import type { Reparto } from "@/types/db";
import { itemStageOf, type KitchenStage } from "./derive";

function itemDetails(it: KItem): string[] {
  return [
    ...(it.opzioni ?? []).map((x) => x.scelta),
    ...(it.composizione ?? []).map((c) => `${c.qta}× ${c.nome}`),
    ...(it.nota ? [`📝 ${it.nota}`] : []),
  ];
}

/** mm:ss remaining for one dish (negative ⇒ overrun, shown with +). */
function countdown(it: KItem, now: number): { text: string; late: boolean } | null {
  if (!it.preparazione_at || !it.tempo_preparazione) return null;
  const end = new Date(it.preparazione_at).getTime() + it.tempo_preparazione * 60000;
  const ms = end - now;
  const late = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return { text: `${late ? "+" : ""}${mm}:${ss}`, late };
}

const NEXT: Record<KitchenStage, { stage: KitchenStage; label: string } | null> = {
  da_preparare: { stage: "in_preparazione", label: "Avvia" },
  in_preparazione: { stage: "pronti", label: "Pronto" },
  pronti: { stage: "serviti", label: "Ritira" },
  serviti: null,
};

export default function ItemRow({
  item,
  lineIndex,
  repartoOn,
  repartoById,
  tempoStimatoOn,
  now,
  onStage,
}: {
  item: KItem;
  lineIndex: number;
  repartoOn: boolean;
  repartoById: Map<string, Reparto>;
  tempoStimatoOn: boolean;
  now: number;
  onStage: (lineIndex: number, stage: KitchenStage) => void;
}) {
  const stage = itemStageOf(item);
  const rep = repartoOn && item.reparto ? repartoById.get(item.reparto) : null;
  const details = itemDetails(item);
  const cd = tempoStimatoOn && stage === "in_preparazione" ? countdown(item, now) : null;
  const next = NEXT[stage];
  const done = stage === "serviti";
  const ready = stage === "pronti";

  return (
    <li
      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
        done
          ? "opacity-50"
          : ready
          ? "bg-green-500/10"
          : stage === "in_preparazione"
          ? "bg-sky-500/10"
          : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{item.qta}×</span>
          <span className="truncate">{item.nome}</span>
          {item.taglia ? (
            <span className="text-sm opacity-70">· {item.taglia}</span>
          ) : null}
          {rep ? (
            <span
              className="rounded px-1.5 text-[11px] font-bold"
              style={{ background: rep.colore ?? "#3338", color: "#fff" }}
            >
              {rep.nome}
            </span>
          ) : null}
        </div>
        {details.length ? (
          <p className="text-sm opacity-70">{details.join(" · ")}</p>
        ) : null}
      </div>
      {cd ? (
        <span
          className={`shrink-0 tabular-nums text-sm font-bold ${
            cd.late ? "text-red-400" : "text-sky-300"
          }`}
        >
          ⏱ {cd.text}
        </span>
      ) : null}
      {next ? (
        <button
          onClick={() => onStage(lineIndex, next.stage)}
          className={`shrink-0 rounded-md px-2.5 py-1 text-sm font-bold ${
            ready
              ? "bg-green-600 text-white"
              : stage === "in_preparazione"
              ? "bg-amber-500 text-black"
              : "bg-white/15 text-white"
          }`}
        >
          {next.label}
        </button>
      ) : (
        <span className="shrink-0 text-green-400">✓</span>
      )}
    </li>
  );
}
