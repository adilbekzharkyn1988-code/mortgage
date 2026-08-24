/**
 * aiService — фасад для всех AI-операций в приложении.
 *
 * На ЭТАПЕ 1 это заглушка: она определяет интерфейс, которым будут
 * пользоваться компоненты (страница "AI-анализ документа",
 * страница "AI-анализ досье"), но реальных вызовов к Gemini ещё нет.
 *
 * На ЭТАПЕ 2 сюда добавится обращение к lib/ai/gemini.ts,
 * lib/ai/documentAnalysis.ts и lib/ai/caseAnalysis.ts.
 * Компоненты, которые уже будут написаны против этого интерфейса,
 * менять не придётся.
 */

import { ClientDocument, DocumentAnalysisResult } from "@/types/document";
import { DossierAnalysis } from "@/types/mortgageCase";

export const aiService = {
  async analyzeDocument(
    _document: ClientDocument
  ): Promise<DocumentAnalysisResult> {
    throw new Error(
      "aiService.analyzeDocument ещё не реализован — будет подключено на ЭТАПЕ 2 (Gemini API)."
    );
  },

  async analyzeDossier(_caseId: string): Promise<DossierAnalysis> {
    throw new Error(
      "aiService.analyzeDossier ещё не реализован — будет подключено на ЭТАПЕ 2 (Gemini API)."
    );
  },
};
