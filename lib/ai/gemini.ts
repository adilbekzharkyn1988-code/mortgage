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

// ВАЖНО: "gemini-flash-latest" — плавающий алиас. На практике он привязан к
// самой свежей модели семейства Flash (сейчас — gemini-3.8-flash), у которой
// на бесплатном тарифе очень скромная квота (например, 20 запросов/день) и
// более высокая цена, чем у Flash-Lite. Поэтому дефолт закреплён на конкретной
// модели с щедрой бесплатной квотой и низкой ценой ($0.25/$1.50 за 1М токенов
// на момент написания), а не на алиасе "-latest". Переопределяется через
// переменную окружения GEMINI_MODEL, если нужно явно указать другую модель.
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

// Ошибки, которые имеет смысл повторить с задержкой:
// - 503 (модель перегружена/недоступна) — транзиентно по своей природе.
// - 429 по МИНУТНОЙ квоте (rate limit) — тоже транзиентно, пройдёт в
//   пределах десятков секунд.
// 429 по ДНЕВНОЙ квоте (RESOURCE_EXHAUSTED, PerDay) сюда не входит: квота не
// восстановится в течение секунд, повторные попытки только тратят время
// впустую и всё равно упрутся в ту же ошибку — см. isDailyQuotaExceeded ниже.
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 4; // 1 исходная попытка + 3 повтора
const BASE_DELAY_MS = 800;

/**
 * Отличает "дневная квота бесплатного тарифа исчерпана" (ретраить бессмысленно)
 * от "превышен лимит запросов в минуту" (можно и нужно повторить). Google
 * кладёт это различие в quota_id/quotaId внутри тела ошибки, например:
 * "GenerateRequestsPerDayPerProjectPerModel-FreeTier" против
 * "...PerMinutePerProjectPerModel-FreeTier".
 */
function isDailyQuotaExceeded(status: number, detail: string): boolean {
  if (status !== 429) return false;
  // Специально смотрим только на "PerDay" в quota_id: тело ошибки может
  // одновременно перечислять и минутное, и дневное нарушение — если среди
  // них есть дневное, ждать секунды бессмысленно в любом случае.
  return /PerDay/i.test(detail);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Задержка перед повтором: экспоненциальный backoff с джиттером
 * (0.8с → ~1.6с → ~3.2с), чтобы не долбить API впритык друг за другом,
 * если Google временно перегружен.
 */
function retryDelayMs(attempt: number): number {
  const exponential = BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.random() * 0.3 * exponential;
  return exponential + jitter;
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

  const requestBody = JSON.stringify({
    systemInstruction: {
      role: "system",
      parts: [{ text: params.systemPrompt }],
    },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  let response: Response | null = null;
  let lastErrorDetail = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
    } catch {
      // Сетевая ошибка (обрыв соединения и т.п.) — тоже транзиентная,
      // повторяем по той же логике, что и 429/503.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      throw new Error("Не удалось связаться с Gemini API (сетевая ошибка).");
    }

    if (response.ok) break;

    let fullDetail = "";
    try {
      // Читаем ПОЛНОЕ тело: quota_id/quotaId с "PerDay" может оказаться
      // дальше 500 символов (после links/violations), а он нам нужен целиком
      // для isDailyQuotaExceeded — усечение делаем только для сообщения юзеру.
      fullDetail = await response.text();
    } catch {
      // игнорируем — не критично для сообщения об ошибке
    }
    const detail = fullDetail.slice(0, 500);
    lastErrorDetail = detail;

    if (isDailyQuotaExceeded(response.status, fullDetail)) {
      throw new Error(
        "Дневная бесплатная квота Gemini API для этой модели исчерпана. " +
          "Повторные попытки не помогут — квота обновится на следующие сутки. " +
          "Подключите оплату в Google AI Studio/Cloud Console или дождитесь сброса квоты. " +
          `${detail}`
      );
    }

    const shouldRetry = RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS;
    if (!shouldRetry) {
      throw new Error(`Gemini API вернул ошибку ${response.status}. ${detail}`);
    }

    await sleep(retryDelayMs(attempt));
    // response будет перезаписан на следующей итерации
  }

  if (!response || !response.ok) {
    throw new Error(
      `Gemini API вернул ошибку после ${MAX_ATTEMPTS} попыток. ${lastErrorDetail}`
    );
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
