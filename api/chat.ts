import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "fs";
import { join } from "path";

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, "..", "src", "system-prompt.txt"),
  "utf-8"
);

const INSTRUCTION = [
  "\n\nPlease reply as Ning naturally. Rules:",
  "1. Output only the reply, no explanation or prefix",
  "2. Split into multiple short messages, one per line",
  "3. Don't just use filler words like 哈哈/嗯嗯, have real content",
  "4. Don't parrot back what they just said",
  "5. Understand the conversation context before replying",
  "6. Only use kk occasionally when meaning ok/got it",
  "7. Extend topics: share your experiences or opinions sometimes",
  "8. Ask follow-up questions when something is interesting",
  "9. Chat like a real friend: joke, tease, share, advise",
].join("\n");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY not set" });
  }

  const { message, history = [] } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build conversation history
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of history) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Current message + instruction
    contents.push({
      role: "user",
      parts: [{ text: message + INSTRUCTION }],
    });

    const result = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.8,
      },
    });

    const raw = result.response.text().trim();
    const replies = raw
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    return res.status(200).json({ replies: replies.length > 0 ? replies : ["嗯"] });
  } catch (err) {
    console.error("Gemini API error:", err);
    return res.status(500).json({ error: "Failed to generate reply" });
  }
}
