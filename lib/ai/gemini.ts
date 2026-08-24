/**
 * gemini.ts — тонкая обёртка над Gemini API.
 *
 * ЭТАП 1: не реализовано (заглушка).
 * ЭТАП 2: здесь появится функция вызова Gemini (google-generativeai / REST),
 * работающая по единому контракту, который использует aiService.
 *
 * Смысл вынесения в отдельный файл: если позже потребуется заменить
 * Gemini на OpenAI или другой AI API, достаточно будет переписать
 * только этот файл (и, возможно, promptы), не трогая остальной код.
 */

export interface GeminiCompletionParams {
  systemPrompt: string;
  userPrompt: string;
}

export async function callGemini(_params: GeminiCompletionParams): Promise<string> {
  throw new Error("callGemini ещё не реализован — будет добавлено на ЭТАПЕ 2.");
}
