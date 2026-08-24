/**
 * gemini.ts — тонкая обёртка над Gemini API.
 *
 * ВАЖНО: этот модуль обращается к сети и читает GEMINI_API_KEY из
 * переменных окружения сервера. Он должен импортироваться ТОЛЬКО из
 * серверного кода (Route Handler'ов в /app/api/**), никогда — из
 * React-компонентов. Компоненты обращаются к AI через
 * lib/services/aiService.ts, который делает fetch на серверный endpoint.
 *
 * Если позже потребуется заменить Gemini на другой AI API — достаточно
 * переписать этот файл, не трогая остальной код.
 */

export interface GeminiFilePart {
  /** MIME-тип файла, например "application/pdf" или "image/jpeg". */
  mimeType: string;
  /** Содержимое файла в base64 (без префикса "data:...;base64,"). */
  data: string;
}

export interface GeminiCompletionParams {
  systemPrompt: string;
  userPrompt: string;
  file?: GeminiFilePart;
}

const DEFAULT_MODEL = "gemini-2.5-flash";

function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

interface GeminiResponsePart {
  text?: string;
}

interface GeminiResponseCandidate {
  content?: {
    parts?: GeminiResponsePart[];
  };
  finishReason?: string;
}

interface GeminiApiResponse {
  candidates?: GeminiResponseCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
}

/**
 * Вызывает Gemini API (generateContent) с системным промптом, пользовательским
 * промптом и, опционально, файлом (изображение/PDF), переданным как inline
 * base64-данные. Возвращает "сырой" текстовый ответ модели (ожидается JSON-строка,
 * т.к. вызывающий код запрашивает responseMimeType: "application/json").
 */
export async function callGemini(params: GeminiCompletionParams): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY не задан в переменных окружения сервера. Добавьте его в .env.local."
    );
  }

  const parts: Record<string, unknown>[] = [];
  if (params.file) {
    parts.push({
      inlineData: {
        mimeType: params.file.mimeType,
        data: params.file.data,
      },
    });
  }
  parts.push({ text: params.userPrompt });

  const model = getModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          role: "system",
          parts: [{ text: params.systemPrompt }],
        },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw new Error("Не удалось связаться с Gemini API (сетевая ошибка).");
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      // игнорируем — не критично для сообщения об ошибке
    }
    throw new Error(`Gemini API вернул ошибку ${response.status}. ${detail}`);
  }

  const data = (await response.json()) as GeminiApiResponse;

  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini отклонил запрос (${data.promptFeedback.blockReason}).`
    );
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini не вернул текстовый ответ.");
  }

  return text;
}
