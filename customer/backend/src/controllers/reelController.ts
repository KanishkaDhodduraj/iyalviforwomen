import type { RequestHandler } from "express";

import { Reel } from "../models/Reel.js";

export const listActiveReels: RequestHandler = async (_request, response) => {
  const reels = await Reel.find({ isActive: true })
    .sort({ order: 1, createdAt: -1 })
    .lean()
    .exec();
  response.json({
    reels: reels.flatMap((reel) => {
      const parsed = parseInstagramLink(reel.instagramUrl);
      if (!parsed) return [];
      return [{ ...reel, ...parsed }];
    }),
  });
};

export function parseInstagramLink(value: string): { shortcode: string; instagramUrl: string } | null {
  try {
    const url = new URL(value);
    const match = /^\/(reel|p)\/([A-Za-z0-9_-]{1,20})\/?$/i.exec(url.pathname);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      !match
    ) {
      return null;
    }
    return {
      shortcode: match[2]!,
      instagramUrl: `https://www.instagram.com/${match[1]!.toLowerCase()}/${match[2]}/`,
    };
  } catch {
    return null;
  }
}
