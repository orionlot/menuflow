"use client";

import { useEffect, useState } from "react";

/** Click-to-zoom lightbox. Uses event delegation: any <img data-zoom> on the
 *  page opens a full-screen high-res preview (Esc / click / × to close). Mounted
 *  once; keeps the rest of the page a server component. */
export default function Lightbox() {
  const [img, setImg] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("img[data-zoom]") as HTMLImageElement | null;
      if (el) setImg({ src: el.currentSrc || el.src, alt: el.alt });
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setImg(null);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!img) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [img]);

  if (!img) return null;
  return (
    <div
      onClick={() => setImg(null)}
      role="dialog"
      aria-modal="true"
      aria-label="Anteprima ingrandita"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8,20,15,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        cursor: "zoom-out",
        animation: "lbfade .18s ease",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.src}
        alt={img.alt}
        style={{ maxWidth: "94vw", maxHeight: "92vh", objectFit: "contain", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}
      />
      <button
        aria-label="Chiudi anteprima"
        onClick={() => setImg(null)}
        style={{
          position: "fixed",
          top: 16,
          right: 18,
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.16)",
          color: "#fff",
          fontSize: 26,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>
      <style>{`@keyframes lbfade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
