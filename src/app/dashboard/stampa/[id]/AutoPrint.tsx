"use client";

import { useEffect } from "react";

export default function AutoPrint() {
  useEffect(() => {
    // Self-print ONLY when this page is the TOP-LEVEL document — i.e. the manual
    // window.open(...) tabs and Chrome --kiosk-printing tabs. When embedded in the
    // silent print iframe (printComandaSilently), a script print() from a sub-frame
    // is captured against the PARENT document by Chromium and prints blank
    // (https://issues.chromium.org/issues/40896385), so here the PARENT drives the
    // print on the iframe's contentWindow instead and AutoPrint must stay inert.
    if (window.self !== window.top) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);
  return null;
}
