/**
 * Silently print an order's comanda from a dashboard page (no pop-up window,
 * no separate tab). Client-only; no-op on the server.
 *
 * Approach: fetch the comanda markup from /dashboard/stampa/<id> (same-origin,
 * carries the dashboard session cookie), inject ONLY its <main data-comanda>
 * into the CURRENT document inside a hidden host, then call window.print() on
 * the top-level window with a print-scoped stylesheet that hides everything
 * except the comanda. After the dialog resolves the host is removed.
 *
 * Why not a hidden iframe: a script print() invoked from inside a sub-frame is
 * captured by Chromium against the TOP-LEVEL document, and hidden/zero-area
 * iframes are frequently not rasterised by the print engine — both yield a
 * BLANK page. Printing the top-level document (with the comanda injected and
 * everything else hidden for print) is the reliable, verifiable path. With
 * Chrome --kiosk-printing it prints silently; otherwise the dialog appears,
 * now showing the comanda.
 *
 * Jobs run one at a time through a module-level queue so concurrent orders
 * never stack multiple print dialogs.
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

async function printOne(orderId: string): Promise<void> {
  // Fetch the comanda markup (same-origin → authenticated). A non-comanda
  // response (e.g. the login page after a session expiry, or a 404) has no
  // [data-comanda] element, so we simply skip it.
  let main: Element | null = null;
  try {
    const res = await fetch(`/dashboard/stampa/${orderId}`, { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    main = parsed.querySelector("[data-comanda]");
  } catch {
    return;
  }
  if (!main) return;

  const host = document.createElement("div");
  host.id = "comanda-print-host";
  host.appendChild(document.importNode(main, true));

  const style = document.createElement("style");
  style.setAttribute("data-comanda-print", "");
  style.textContent =
    // Never visible on screen — it only exists to be printed.
    "#comanda-print-host{display:none}" +
    "@media print{" +
    // Hide the whole app; show only the comanda.
    "body>*:not(#comanda-print-host){display:none!important}" +
    "#comanda-print-host{display:block!important}" +
    // The app root layout uses html.h-full + a flex body; reset it so the print
    // box is normal block flow (otherwise the printed area can collapse/clip).
    "html,body{height:auto!important;min-height:0!important;display:block!important;margin:0!important;background:#fff!important}" +
    "}";

  document.body.appendChild(style);
  document.body.appendChild(host);

  await new Promise<void>((resolve) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("afterprint", cleanup);
      host.remove();
      style.remove();
      resolve();
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    // Two animation frames guarantee the injected comanda is laid out and
    // painted before we snapshot it for print.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        try {
          window.print();
        } catch {
          cleanup();
        }
      }),
    );
    // Backstop: afterprint may not fire under --kiosk-printing; never wedge the
    // queue and never leave the host in the DOM.
    setTimeout(cleanup, 20000);
  });
}
