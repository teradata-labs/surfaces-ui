import { describe, expect, it } from "vitest";
import { isMeasurementId, optedOut, pagePath } from "./analytics.js";

describe("pagePath", () => {
  it("names the area", () => {
    expect(pagePath("#chat")).toBe("/chat");
    expect(pagePath("")).toBe("/");
  });

  it("keeps what names a page of the site", () => {
    expect(pagePath("#docs?page=getting-started.md")).toBe("/docs?page=getting-started.md");
    expect(pagePath("#showcase?persona=analyst")).toBe("/showcase?persona=analyst");
  });

  it("leaves out a person's own things", () => {
    expect(pagePath("#composer?surface=my-private-board")).toBe("/composer");
    expect(pagePath("#docs?page=a.md&surface=x&q=secret")).toBe("/docs?page=a.md");
  });
});

describe("isMeasurementId", () => {
  it("takes Google's form only", () => {
    expect(isMeasurementId("G-AB12CD34EF")).toBe(true);
    expect(isMeasurementId("")).toBe(false);
    expect(isMeasurementId("UA-1234-1")).toBe(false);
    expect(isMeasurementId("G-1&x=<script>")).toBe(false);
  });
});

describe("optedOut", () => {
  it("honours Global Privacy Control and Do Not Track", () => {
    expect(optedOut({ globalPrivacyControl: true })).toBe(true);
    expect(optedOut({ doNotTrack: "1" })).toBe(true);
    expect(optedOut({ doNotTrack: null })).toBe(false);
  });
});
