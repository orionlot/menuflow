import { describe, it, expect } from "vitest";
import { tenantSubdomainUrl, isMapsUrl } from "@/lib/urls";
import { ROOT_DOMAIN } from "@/lib/env";

describe("tenantSubdomainUrl", () => {
  it("builds slug.localhost (apex) in dev, keeping the port", () => {
    expect(tenantSubdomainUrl("http://localhost:3000", "caterina")).toBe("http://caterina.localhost:3000");
  });

  it("does NOT duplicate the slug when the dashboard is on a tenant subdomain (dev)", () => {
    expect(tenantSubdomainUrl("http://caterina.localhost:3000", "caterina")).toBe(
      "http://caterina.localhost:3000",
    );
  });

  it("builds slug.<root> from the configured apex, ignoring the current subdomain (prod)", () => {
    // The reported bug: visiting the dashboard at slug.<root> must not yield slug.slug.<root>.
    expect(tenantSubdomainUrl("https://caterina.metaslash.it", "caterina")).toBe(
      `https://caterina.${ROOT_DOMAIN}`,
    );
    expect(tenantSubdomainUrl("https://metaslash.it", "altro")).toBe(`https://altro.${ROOT_DOMAIN}`);
  });

  it("appends ?tavolo=", () => {
    expect(tenantSubdomainUrl("https://metaslash.it", "x", "7")).toBe(`https://x.${ROOT_DOMAIN}?tavolo=7`);
  });
});

describe("isMapsUrl", () => {
  it("accepts https Google-Maps hosts", () => {
    expect(isMapsUrl("https://www.google.com/maps/@1,2,15z")).toBe(true);
    expect(isMapsUrl("https://maps.google.it/?q=1,2")).toBe(true);
    expect(isMapsUrl("https://maps.app.goo.gl/abc")).toBe(true);
  });

  it("rejects non-Maps hosts, lookalikes, http, and the generic shortener", () => {
    expect(isMapsUrl("https://evil.com/x")).toBe(false);
    expect(isMapsUrl("https://google.com.evil.com/maps")).toBe(false);
    expect(isMapsUrl("https://evilgoogle.com/maps")).toBe(false);
    expect(isMapsUrl("http://www.google.com/maps")).toBe(false);
    expect(isMapsUrl("https://goo.gl/maps/x")).toBe(false);
    expect(isMapsUrl("javascript:alert(1)")).toBe(false);
    expect(isMapsUrl("not a url")).toBe(false);
  });
});
