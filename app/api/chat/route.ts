import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { message, history, systemContext } = await req.json();

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY not set");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemContext ??
        "You are a helpful industrial service desk AI assistant. Be concise, technical, and practical.",
    });

    const chat = model.startChat({
      history: (history ?? []).map((m: { role: string; text: string }) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })),
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text() || "Sorry, I couldn't process that.";
    return Response.json({ reply });
  } catch (error: any) {
    console.error("Gemini chat error:", error);
    return Response.json(
      { error: "Error processing request", details: error?.message },
      { status: 500 },
    );
  }
}
