import { describe, expect, it } from "vitest";
import { trustedOrigins } from "./auth-origins";

describe("trustedOrigins", () => {
  it("trusts the auth address and the address the site is served from", () => {
    expect(trustedOrigins("https://eatri8-ai.shashwa7.in", new URL("https://santul.shashwa7.in/"))).toEqual(["https://eatri8-ai.shashwa7.in", "https://santul.shashwa7.in"]);
  });
  it("lists one origin when they are the same, ignoring paths and trailing slashes", () => {
    expect(trustedOrigins("https://santul.app/", new URL("https://santul.app"))).toEqual(["https://santul.app"]);
    expect(trustedOrigins("http://localhost:3000", new URL("http://localhost:3000/"))).toEqual(["http://localhost:3000"]);
  });
});
