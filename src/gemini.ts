import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API
// Note: In production, you should store the API key securely
// For a browser extension, consider using chrome.storage or environment variables
const API_KEY = process.env.PLASMO_PUBLIC_GEMINI_API_KEY || "";

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

/**
 * Initialize Gemini with API key
 * Call this before using any Gemini functions
 */
export function initializeGemini(apiKey?: string) {
  const key = apiKey || API_KEY;
  if (!key) {
    throw new Error("Gemini API key is required");
  }
  genAI = new GoogleGenerativeAI(key);
  model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
}

/**
 * Send a prompt to Gemini and get a response
 * @param prompt - The text prompt to send
 * @returns The generated text response
 */
export async function sendPromptToGemini(prompt: string): Promise<string> {
  if (!model) {
    throw new Error("Gemini not initialized. Call initializeGemini() first.");
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

/**
 * Send a prompt with streaming response
 * @param prompt - The text prompt to send
 * @param onChunk - Callback function called for each chunk of text
 */
export async function sendPromptWithStreaming(
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  if (!model) {
    throw new Error("Gemini not initialized. Call initializeGemini() first.");
  }

  try {
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      onChunk(chunkText);
    }
  } catch (error) {
    console.error("Error streaming from Gemini API:", error);
    throw error;
  }
}

/**
 * Chat session for multi-turn conversations
 */
export class GeminiChat {
  private chatSession: any;

  constructor() {
    if (!model) {
      throw new Error("Gemini not initialized. Call initializeGemini() first.");
    }
    this.chatSession = model.startChat({
      history: []
    });
  }

  /**
   * Send a message in the chat
   * @param message - The message to send
   * @returns The response text
   */
  async sendMessage(message: string): Promise<string> {
    try {
      const result = await this.chatSession.sendMessage(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error in chat session:", error);
      throw error;
    }
  }

  /**
   * Get the chat history
   */
  getHistory() {
    return this.chatSession.getHistory();
  }
}

// Export a helper to check if Gemini is initialized
export function isGeminiInitialized(): boolean {
  return model !== null;
}
