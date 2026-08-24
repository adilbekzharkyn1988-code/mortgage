/**
 * aiService — фасад для всех AI-операций в приложении.
 *
 * Работает в браузере (используется из React-компонентов), поэтому НИКОГДА
 * не вызывает Gemini напрямую и не импортирует lib/ai/* — вместо этого
 * делает fetch на серверный Route Handler, который единственный имеет
 * доступ к GEMINI_API_KEY.
 *
 * ЭТАП 4.1: именно здесь, а не на сервере, должно происходить чтение
 * localStorage. Route Handler'ы выполняются на сервере, где localStorage
 * недоступен — поэтому aiService сам собирает нужные данные дела через
 * caseService/clientService/documentService (они уже умеют работать с
 * localStorage в браузере) и передаёт их серверу в теле запроса. После
 * ответа сервера результат анализа тоже сохраняется здесь же, на клиенте.
 */

import { ClientDocument, DocumentAnalysisResult, ExtractedFields } from "@/types/document";
import { DossierAnalysis } from "@/types/mortgageCase";
import { caseService } from "./caseService";
import { clientService } from "./clientService";
import { documentService } from "./documentService";

function getConfirmedFields(
  documents: ClientDocument[],
  type: ClientDocument["type"]
): ExtractedFields | null {
  const doc = documents.find((d) => d.type === type && d.status === "confirmed");
  return doc?.confirmedFields ?? null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Не удалось прочитать файл."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

export const aiService = {
  /**
   * Отправляет документ на AI-анализ. `file` — исходный File-объект,
   * выбранный консультантом (хранится только в памяти сессии, см. п.15 ТЗ —
   * постоянное файловое хранилище на MVP-0 не требуется).
   */
  async analyzeDocument(
    document: ClientDocument,
    file: File
  ): Promise<DocumentAnalysisResult> {
    const base64Data = await fileToBase64(file);

    let response: Response;
    try {
      response = await fetch("/api/ai/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: document.type,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64Data,
        }),
      });
    } catch {
      throw new Error("Не удалось связаться с сервером анализа. Проверьте соединение.");
    }

    let payload: { result?: DocumentAnalysisResult; error?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.result) {
      throw new Error(payload?.error ?? "Не удалось проанализировать документ.");
    }

    return payload.result;
  },

  /**
   * Отправляет дело на AI-анализ.
   *
   * ЭТАП 4.1: данные дела (client, case, documents, подтверждённые поля,
   * несоответствия) читаются здесь, на клиенте, из localStorage через
   * caseService/clientService/documentService — сервер их прочитать не
   * может. Собранные данные передаются в теле POST-запроса. Результат,
   * который вернёт сервер, сохраняется обратно в localStorage тоже здесь.
   */
  async analyzeDossier(caseId: string): Promise<DossierAnalysis> {
    const mortgageCase = await caseService.getById(caseId);
    if (!mortgageCase) {
      throw new Error("Дело не найдено.");
    }

    const client = await clientService.getById(mortgageCase.clientId);
    if (!client) {
      throw new Error("Клиент дела не найден.");
    }

    const documents = await documentService.getByCaseId(caseId);

    let response: Response;
    try {
      response = await fetch("/api/ai/analyze-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client,
          mortgageCase,
          documents,
          confirmedIdentity: getConfirmedFields(documents, "identity"),
          confirmedIncome: getConfirmedFields(documents, "income_certificate"),
          confirmedCredit: getConfirmedFields(documents, "credit_history"),
          existingDiscrepancies: mortgageCase.discrepancies,
        }),
      });
    } catch {
      throw new Error("Не удалось связаться с сервером анализа. Проверьте соединение.");
    }

    let payload: { result?: DossierAnalysis; error?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.result) {
      throw new Error(payload?.error ?? "Не удалось выполнить анализ досье.");
    }

    // Сервер только анализирует и ничего не хранит — сохраняем результат
    // в дело (localStorage) здесь, на клиенте.
    await caseService.addAnalysis(caseId, payload.result);

    return payload.result;
  },
};
