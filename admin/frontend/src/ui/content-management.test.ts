import { describe, expect, it } from "vitest";
import { reelFormSchema } from "./content-management";

describe("reel form validation", () => {
  const validReel = {
    title: "Spring collection",
    instagramUrl: "https://www.instagram.com/reel/Ab_123/",
    order: 0,
    isActive: true,
  };

  it("accepts Instagram reel and post links", () => {
    expect(reelFormSchema.safeParse(validReel).success).toBe(true);
    expect(reelFormSchema.safeParse({
      ...validReel,
      instagramUrl: "https://www.instagram.com/p/Ab_123/",
    }).success).toBe(true);
  });

  it.each([
    "http://instagram.com/reel/Ab_123/",
    "https://instagram.com.evil.test/reel/Ab_123/",
    "https://user@instagram.com/reel/Ab_123/",
  ])("rejects an invalid Instagram URL: %s", (instagramUrl) => {
    expect(reelFormSchema.safeParse({ ...validReel, instagramUrl }).success).toBe(false);
  });
});
