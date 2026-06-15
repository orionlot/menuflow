import type { ReactNode } from "react";

/**
 * The single admin content container. One max-width + centring for every admin
 * page (dashboard + platform admin) so widths and gutters stay consistent.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-5xl px-4 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}
