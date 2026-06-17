/**
 * Silently print an order's comanda from a dashboard page (no pop-up window).
 * Loads /dashboard/stampa/<id> into a hidden, off-screen iframe; that page's
 * own AutoPrint fires window.print() on the iframe document, so the comanda
 * prints without a separate tab. With Chrome --kiosk-printing it goes straight
 * to the default printer; otherwise the browser shows its print dialog.
 *
 * Client-only. No-op on the server.
 *
 * Jobs are processed ONE AT A TIME through a module-level queue: when several
 * orders arrive in the same poll/realtime tick we must not open several print
 * dialogs at once (in the non-kiosk path only the first would survive and the
 * rest would be silently dropped). Each job's iframe is removed — and the next
 * job started — only after the print dialog resolves (the iframe's `afterprint`
 * event), so we never yank an open dialog out from under the operator. A
 * backstop timer guards against browsers that never emit `afterprint`.
 */

const queue: string[] = [];
let draining = false;

export function printComandaSilently(orderId: string): void {
  if (typeof document === "undefined" || !orderId) return;
  queue.push(orderId);
  if (!draining) void drainQueue();
}

async function drainQueue(): Promise<void> {
  draining = true;
  try {
    while (queue.length) {
      const id = queue.shift();
      if (id) await printOne(id);
    }
  } finally {
    draining = false;
  }
}

function printOne(orderId: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
    iframe.src = `/dashboard/stampa/${orderId}`;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (iframe.parentNode) iframe.remove();
      resolve();
    };

    iframe.onload = () => {
      // If the iframe loaded something other than the comanda — e.g. the login
      // page after the dashboard session expired — there is nothing to print;
      // move on immediately instead of waiting out the backstop.
      try {
        if (!iframe.contentDocument?.querySelector("[data-comanda]")) {
          finish();
          return;
        }
      } catch {
        /* same-origin read unexpectedly blocked — assume it's the comanda */
      }
      // The comanda page's AutoPrint fires window.print() shortly after load.
      // Wait for the dialog to resolve before tearing the iframe down and
      // starting the next job. Backstop in case `afterprint` never fires
      // (some kiosk configs): generous enough not to interrupt an open dialog.
      iframe.contentWindow?.addEventListener("afterprint", finish, { once: true });
      setTimeout(finish, 20000);
    };

    // Hard safety net if the iframe never loads at all.
    setTimeout(finish, 30000);
    document.body.appendChild(iframe);
  });
}
