import "server-only";
import type { Order, Restaurant } from "@/types/db";
import { formatEUR } from "@/lib/config/plans";

/**
 * Two SEPARATE Telegram bots:
 *  - ORDINI: standard new-order notification.
 *  - PAGAMENTI: framed as an ACTION ("battere scontrino"), never as a fiscal
 *    confirmation — the platform does not issue fiscal receipts.
 *
 * Both use different tokens (different env vars) and send to different chats on
 * (typically) the same phone. If tokens/chats are missing, we no-op and log so
 * the rest of the order flow keeps working locally without Telegram.
 */

async function send(
  token: string | undefined,
  chatId: string | null,
  text: string,
  threadId?: number | null,
) {
  if (!token || !chatId) {
    console.log(
      `[telegram:STUB] (token=${token ? "set" : "missing"}, chat=${chatId ?? "missing"})\n${text}`,
    );
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        // When set, deliver into a specific forum Topic ("Ordini"/"Pagamenti").
        ...(threadId ? { message_thread_id: threadId } : {}),
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error("[telegram] send failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[telegram] network error", err);
  }
}

/** Escape user-supplied text for an HTML (parse_mode) message — including the
 *  quote chars, so it is also safe inside an attribute like `href="…"`. */
function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function itemsBlock(order: Pick<Order, "items">): string {
  return order.items
    .map((i) => {
      let line = `• ${i.qta}× ${escapeHtml(i.nome)} — ${formatEUR(Math.round(i.prezzo * 100))}`;
      const details = [
        i.taglia ? `formato: ${i.taglia}` : "",
        (i.opzioni ?? []).map((o) => o.scelta).join(", "),
        (i.composizione ?? []).map((c) => `${c.qta}× ${c.nome}`).join(", "),
      ]
        .filter(Boolean)
        .join(" · ");
      if (details) line += `\n   ${escapeHtml(details)}`;
      if (i.nota) line += `\n   📝 ${escapeHtml(i.nota)}`;
      return line;
    })
    .join("\n");
}

/** Bot ORDINI: standard new order. */
export async function notifyNewOrder(
  restaurant: Pick<Restaurant, "telegram_chat_ordini" | "telegram_topic_ordini">,
  order: Order,
) {
  const dest =
    order.tipo === "delivery"
      ? `🛵 Delivery · ${escapeHtml(order.tavolo ?? "—")}`
      : order.tipo === "asporto" || order.asporto
        ? `🛍 Asporto · ${escapeHtml(order.tavolo ?? "—")}`
        : `Tavolo ${escapeHtml(order.tavolo ?? "—")}`;
  const text = [
    `🧾 <b>NUOVO ORDINE</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `${dest}  ·  <b>${formatEUR(Math.round(order.totale * 100))}</b>`,
    order.indirizzo ? `📍 ${escapeHtml(order.indirizzo)}` : "",
    order.posizione ? `🗺 <a href="${escapeHtml(order.posizione)}">Posizione su Maps</a>` : "",
    itemsBlock(order),
    order.note ? `\n📝 ${escapeHtml(order.note)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await send(
    process.env.TELEGRAM_BOT_ORDINI_TOKEN,
    restaurant.telegram_chat_ordini,
    text,
    restaurant.telegram_topic_ordini,
  );
}

/** Bot PAGAMENTI: action to perform, NOT a fiscal confirmation. */
export async function notifyPaidOrder(
  restaurant: Pick<
    Restaurant,
    "telegram_chat_pagamenti" | "telegram_topic_pagamenti"
  >,
  order: Order,
) {
  const hhmm = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(order.pagato_at ? new Date(order.pagato_at) : new Date());

  const text = [
    `🟢💶 <b>PAGATO IN APP — DA REGISTRARE</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `Tavolo ${escapeHtml(order.tavolo ?? "—")}  ·  <b>${formatEUR(Math.round(order.totale * 100))}</b>`,
    itemsBlock(order),
    `━━━━━━━━━━━━━━━━━━`,
    `⚠️ Battere scontrino — ore ${hhmm}`,
  ].join("\n");

  await send(
    process.env.TELEGRAM_BOT_PAGAMENTI_TOKEN,
    restaurant.telegram_chat_pagamenti,
    text,
    restaurant.telegram_topic_pagamenti,
  );
}

/** Sends a test message to the Orders bot to confirm the chat is connected. */
export async function notifyTest(
  restaurant: Pick<
    Restaurant,
    "nome" | "telegram_chat_ordini" | "telegram_topic_ordini"
  >,
) {
  await send(
    process.env.TELEGRAM_BOT_ORDINI_TOKEN,
    restaurant.telegram_chat_ordini,
    `✅ <b>Notifica di prova</b>\nSe leggi questo messaggio, il bot Ordini di “${escapeHtml(restaurant.nome)}” è collegato correttamente.`,
    restaurant.telegram_topic_ordini,
  );
}

/** Bot ORDINI: a customer at a table calls the waiter / asks for the bill. */
export async function notifyServiceRequest(
  restaurant: Pick<Restaurant, "telegram_chat_ordini" | "telegram_topic_ordini">,
  tavolo: string,
  tipo: "cameriere" | "conto",
) {
  const text =
    tipo === "conto"
      ? `🧾 <b>RICHIESTA CONTO</b>\nTavolo ${escapeHtml(tavolo)}`
      : `🔔 <b>CHIAMATA CAMERIERE</b>\nTavolo ${escapeHtml(tavolo)}`;
  await send(
    process.env.TELEGRAM_BOT_ORDINI_TOKEN,
    restaurant.telegram_chat_ordini,
    text,
    restaurant.telegram_topic_ordini,
  );
}
