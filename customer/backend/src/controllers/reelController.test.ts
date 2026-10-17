import { describe, expect, it } from "vitest";
import { parseInstagramLink } from "./reelController.js";

describe("Instagram reel links", () => {
  it.each([
    ["https://www.instagram.com/reel/Ab_123/?utm_source=admin", "Ab_123"],
    ["https://instagram.com/p/Post-45/", "Post-45"],
  ])("extracts a validated shortcode from %s", (url, shortcode) => {
    expect(parseInstagramLink(url)).toEqual({
      shortcode,
      instagramUrl: url.includes("/p/")
        ? `https://www.instagram.com/p/${shortcode}/`
        : `https://www.instagram.com/reel/${shortcode}/`,
    });
  });

  it.each([
    "http://instagram.com/reel/Ab_123/",
    "https://instagram.com.evil.test/reel/Ab_123/",
    "https://instagram.com:444/reel/Ab_123/",
    "https://user@instagram.com/reel/Ab_123/",
    "https://instagram.com/reels/Ab_123/",
    "https://instagram.com/reel/contains.dot/",
  ])("rejects an untrusted or malformed URL: %s", (url) => {
    expect(parseInstagramLink(url)).toBeNull();
  });
});
