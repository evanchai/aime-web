import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.KV_REST_API_URL) {
    return res.status(500).json({ error: "Redis not configured" });
  }

  const redis = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });

  // GET - list conversations
  if (req.method === "GET") {
    const keys = await redis.keys("chat:*");
    if (keys.length === 0) return res.json([]);

    const pipeline = redis.pipeline();
    for (const key of keys) pipeline.get(key);
    const results = await pipeline.exec();

    const conversations = results
      .filter(Boolean)
      .sort((a: any, b: any) => b.ts - a.ts);

    return res.json(conversations);
  }

  // POST - rate a conversation
  if (req.method === "POST") {
    const { id, rating } = req.body || {};
    if (!id || !rating) {
      return res.status(400).json({ error: "id and rating required" });
    }

    const conv: any = await redis.get(id);
    if (!conv) return res.status(404).json({ error: "Not found" });

    conv.rating = rating;
    await redis.set(id, conv, { ex: 86400 * 90 });
    return res.json({ ok: true });
  }

  // DELETE - clear a conversation
  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id required" });
    await redis.del(id);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
