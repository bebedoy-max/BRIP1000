/** Tipe bersama AI Brain (aman dipakai di client maupun server). */
export type AiProvider = "gemini" | "openai" | "anthropic" | "custom";

export type AiBrainView = {
  id: string;
  nama: string;
  provider: AiProvider;
  model: string;
  base_url: string | null;
  aktif: boolean;
  is_default: boolean;
  key_preview: string;
  updated_at?: string | null;
};

export const aiProviders: { value: AiProvider; label: string; model: string }[] = [
  { value: "gemini", label: "Google Gemini", model: "gemini-2.5-flash" },
  { value: "openai", label: "OpenAI", model: "gpt-4o-mini" },
  { value: "anthropic", label: "Anthropic Claude", model: "claude-sonnet-4-20250514" },
  { value: "custom", label: "Kompatibel OpenAI (custom)", model: "" },
];
