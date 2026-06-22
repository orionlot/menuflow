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
  portateOn = false,
  onHold,
}: {
  item: KItem;
  lineIndex: number;
  repartoOn: boolean;
  repartoById: Map<string, Reparto>;
  tempoStimatoOn: boolean;
  now: number;
  onStage: (lineIndex: number, stage: KitchenStage) => void;
  portateOn?: boolean;
  onHold?: (lineIndex: number, held: boolean) => void;
}) {
  const stage = itemStageOf(item);
  const rep = repartoOn && item.reparto ? repartoById.get(item.reparto) : null;
  const details = itemDetails(item);
  const cd = tempoStimatoOn && stage === "in_preparazione" ? countdown(item, now) : null;
  const next = NEXT[stage];
  const done = stage === "serviti";
  const ready = stage === "pronti";
  // Held ("a seguire") only matters while the dish hasn't started yet.
  const held = portateOn && Boolean(item.a_seguire) && stage === "da_preparare";
  const canHold = portateOn && !held && stage === "da_preparare";

  return (
    <li
      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
        held
          ? "bg-violet-50 opacity-80"
          : done
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
          {item.taglia ? <span className="text-sm opacity-70">· {item.taglia}</span> : null}
          {rep ? (
            <span className="rounded px-1.5 text-[11px] font-bold" style={{ background: rep.colore ?? "#3338", color: "#fff" }}>
              {rep.nome}
            </span>
          ) : null}
        </div>
        {details.length ? <p className="text-sm opacity-70">{details.join(" · ")}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {held ? (
          <>
            <span className="rounded-md bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-800">A seguire</span>
            <button
              onClick={() => onHold?.(lineIndex, false)}
              className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-violet-600 active:scale-95"
            >
              Manda ora
            </button>
          </>
        ) : (
          <>
            {cd ? (
              <span className={`tabular-nums text-sm font-bold ${cd.late ? "text-red-400" : "text-sky-300"}`}>⏱ {cd.text}</span>
            ) : null}
            {canHold ? (
              <button
                onClick={() => onHold?.(lineIndex, true)}
                aria-label="Tieni a seguire"
                title="Tieni a seguire (manda dopo)"
                className="grid h-8 w-8 place-items-center rounded-md border border-neutral-200 text-neutral-400 transition hover:bg-neutral-50 hover:text-violet-700"
              >
                ⏸
              </button>
            ) : null}
            {next ? (
              <button
                onClick={() => onStage(lineIndex, next.stage)}
                className={`rounded-md px-3 py-1.5 text-sm font-bold transition active:scale-95 ${
                  ready
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : stage === "in_preparazione"
                    ? "bg-amber-500 text-black hover:bg-amber-400"
                    : "bg-sky-700 text-white hover:bg-sky-600"
                }`}
              >
                {next.label}
              </button>
            ) : (
              <span className="text-lg font-bold text-green-600">✓</span>
            )}
          </>
        )}
      </div>
    </li>
  );
}
