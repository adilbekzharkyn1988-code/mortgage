"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { Client } from "@/types/client";
import {
  ClientDocument,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  DocumentType,
  ExtractedFields,
} from "@/types/document";
import { documentService } from "@/lib/services/documentService";
import { caseService } from "@/lib/services/caseService";
import { clientService } from "@/lib/services/clientService";
import { timelineService } from "@/lib/services/timelineService";
import { aiService } from "@/lib/services/aiService";
import { findDiscrepancies } from "@/lib/matching";
import { mapCreditsToExistingLoans, sumMonthlyPayments } from "@/lib/creditHistory";
import {
  BLANK_FIELDS_BY_TYPE,
  GENERIC_BLANK_FIELDS,
  displayFieldValue,
  fieldLabel,
} from "@/lib/documentFields";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectInput } from "@/components/ui/FormField";
import { formatDate, formatFileSize } from "@/lib/format";
import { DocumentAnalysisModal } from "./DocumentAnalysisModal";

const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS) as [
  DocumentType,
  string,
][];

function statusBadgeTone(status: ClientDocument["status"]) {
  switch (status) {
    case "confirmed":
      return "success" as const;
    case "analyzed":
      return "warn" as const;
    case "analyzing":
      return "navy" as const;
    case "error":
      return "risk" as const;
    case "rejected":
      return "risk" as const;
    default:
      return "neutral" as const;
  }
}

export function DocumentsSection({
  client,
  caseId,
  onDocumentsChange,
  onClientChange,
}: {
  client: Client;
  caseId: string;
  onDocumentsChange?: (documents: ClientDocument[]) => void;
  /** Вызывается, если данные клиента обновились (см. автозаполнение кредитов ниже). */
  onClientChange?: (client: Client) => void;
}) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Файлы, выбранные консультантом в текущей сессии. Постоянное файловое
  // хранилище на MVP-0 не требуется (п.15 ТЗ) — при перезагрузке страницы
  // потребуется загрузить документ заново для повторного анализа.
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [expandedConfirmedId, setExpandedConfirmedId] = useState<string | null>(null);

  const [uploadType, setUploadType] = useState<DocumentType>("identity");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [modalDocId, setModalDocId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"analysis" | "manual">("analysis");

  const reload = useCallback(async () => {
    const docs = await documentService.getByCaseId(caseId);
    setDocuments(docs);
    setLoaded(true);
    onDocumentsChange?.(docs);
  }, [caseId, onDocumentsChange]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const docs = await documentService.getByCaseId(caseId);
      if (cancelled) return;
      setDocuments(docs);
      setLoaded(true);
      onDocumentsChange?.(docs);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function handleFileChosen(file: File) {
    setRowErrors({});
    const doc = await documentService.upload({
      clientId: client.id,
      caseId,
      type: uploadType,
      fileName: file.name,
      fileSizeBytes: file.size,
    });
    setPendingFiles((prev) => ({ ...prev, [doc.id]: file }));
    await reload();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runAnalysis(doc: ClientDocument) {
    const file = pendingFiles[doc.id];
    if (!file) {
      setRowErrors((prev) => ({
        ...prev,
        [doc.id]:
          "Файл недоступен в этой сессии (страница была перезагружена) — загрузите документ заново.",
      }));
      return;
    }

    setAnalyzingId(doc.id);
    setRowErrors((prev) => ({ ...prev, [doc.id]: "" }));
    await documentService.setAnalyzing(doc.id);
    await reload();

    try {
      const result = await aiService.analyzeDocument(doc, file);
      await documentService.setAnalysisResult(doc.id, result);
      await reload();
      setModalMode("analysis");
      setModalDocId(doc.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось проанализировать документ.";
      await documentService.setError(doc.id, message);
      await reload();
    } finally {
      setAnalyzingId(null);
    }
  }

  function openManualEntry(doc: ClientDocument) {
    const blank = BLANK_FIELDS_BY_TYPE[doc.type] ?? GENERIC_BLANK_FIELDS;
    // Не удаляем документ и не выдумываем данные — просто открываем пустую
    // форму для ручного ввода поверх того же документа (п.14 ТЗ).
    documentService
      .setAnalysisResult(doc.id, {
        documentType: doc.type,
        fields: blank,
        warnings: [],
        analyzedAt: new Date().toISOString(),
      })
      .then(async () => {
        await reload();
        setModalMode("manual");
        setModalDocId(doc.id);
      });
  }

  async function handleConfirm(
    doc: ClientDocument,
    confirmedFields: ExtractedFields,
    applyCreditsToClient?: boolean
  ) {
    await documentService.confirm(doc.id, confirmedFields);

    const discrepancies = findDiscrepancies(client, doc.type, confirmedFields);
    for (const discrepancy of discrepancies) {
      await caseService.addDiscrepancy(caseId, discrepancy);
    }

    // Кредитная история: если AI нашёл кредитные линии и консультант оставил
    // включённой автозаполнение — переносим их в "Текущие кредиты" клиента,
    // чтобы не перепечатывать их вручную (см. lib/creditHistory.ts).
    if (doc.type === "credit_history" && applyCreditsToClient) {
      const rawCredits = confirmedFields.credits;
      if (Array.isArray(rawCredits) && rawCredits.length > 0) {
        const existingLoans = mapCreditsToExistingLoans(rawCredits);
        const estimatedMonthlyPayments = sumMonthlyPayments(existingLoans);
        const updatedClient = await clientService.update(client.id, {
          existingLoans,
          estimatedMonthlyPayments,
        });
        if (updatedClient) {
          onClientChange?.(updatedClient);
          await timelineService.addEvent(
            caseId,
            "client_credits_synced",
            `Текущие кредиты обновлены по кредитной истории: ${existingLoans.length} шт.`
          );
        }
      }
    }

    setModalDocId(null);
    await reload();
  }

  const modalDoc = documents.find((d) => d.id === modalDocId) ?? null;

  return (
    <Card>
      <CardHeader eyebrow="Ипотечное дело" title="Документы" />
      <div className="flex flex-col gap-4 p-5">
        {loaded && documents.length === 0 && (
          <p className="text-sm text-ink-soft">Документы ещё не загружены.</p>
        )}

        <div className="flex flex-col divide-y divide-line">
          {documents.map((doc) => {
            const isAnalyzing = analyzingId === doc.id || doc.status === "analyzing";
            const rowError = rowErrors[doc.id];
            const hasFileInSession = Boolean(pendingFiles[doc.id]);

            return (
              <div key={doc.id} className="flex flex-col gap-2.5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-soft">
                      <FileText size={16} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{doc.fileName}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {DOCUMENT_TYPE_LABELS[doc.type]} · {formatFileSize(doc.fileSizeBytes)} ·{" "}
                        {formatDate(doc.uploadedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={statusBadgeTone(doc.status)}>
                      {isAnalyzing ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 size={12} className="animate-spin" /> Анализируется
                        </span>
                      ) : (
                        DOCUMENT_STATUS_LABELS[doc.status]
                      )}
                    </Badge>

                    {(doc.status === "uploaded" || doc.status === "error") && (
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        disabled={isAnalyzing}
                        onClick={() => runAnalysis(doc)}
                      >
                        <Sparkles size={14} />
                        Анализировать с помощью AI
                      </Button>
                    )}

                    {doc.status === "analyzed" && (
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => {
                          setModalMode("analysis");
                          setModalDocId(doc.id);
                        }}
                      >
                        Открыть результат
                      </Button>
                    )}

                    {doc.status === "confirmed" && (
                      <Button
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        onClick={() =>
                          setExpandedConfirmedId((cur) => (cur === doc.id ? null : doc.id))
                        }
                      >
                        <CheckCircle2 size={14} className="text-success" />
                        Данные
                      </Button>
                    )}
                  </div>
                </div>

                {doc.status === "error" && (
                  <div className="flex flex-wrap items-start gap-2.5 rounded-lg border border-risk/20 bg-risk-soft px-3.5 py-2.5 text-sm text-risk">
                    <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Не удалось проанализировать документ.</p>
                      {doc.lastError && (
                        <p className="mt-0.5 text-xs text-risk/80">{doc.lastError}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => runAnalysis(doc)}
                        >
                          Повторить
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => openManualEntry(doc)}
                        >
                          Ввести данные вручную
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {rowError && doc.status !== "error" && (
                  <p className="text-xs text-risk">{rowError}</p>
                )}
                {(doc.status === "uploaded" && !hasFileInSession) && (
                  <p className="text-xs text-ink-faint">
                    Файл этой сессии недоступен после перезагрузки страницы — для анализа
                    потребуется загрузить документ заново.
                  </p>
                )}

                {doc.status === "confirmed" &&
                  expandedConfirmedId === doc.id &&
                  doc.confirmedFields && (
                    <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {Object.entries(doc.confirmedFields).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-xs text-ink-faint">{fieldLabel(key)}</p>
                            <p className="mt-0.5 text-sm text-ink">
                              {displayFieldValue(key, value)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2.5 text-xs text-ink-faint">
                        Подтверждено {formatDate(doc.confirmedAt)}
                      </p>
                    </div>
                  )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <SelectInput
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as DocumentType)}
              className="sm:max-w-xs"
            >
              {DOCUMENT_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChosen(file);
              }}
            />
            <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} />
              Загрузить документ
            </Button>
          </div>
        </div>
      </div>

      {modalDoc && (
        <DocumentAnalysisModal
          document={modalDoc}
          client={client}
          isRetrying={analyzingId === modalDoc.id}
          startInEditMode={modalMode === "manual"}
          onClose={() => setModalDocId(null)}
          onConfirm={(fields, applyCreditsToClient) =>
            handleConfirm(modalDoc, fields, applyCreditsToClient)
          }
          onRetry={() => runAnalysis(modalDoc)}
        />
      )}
    </Card>
  );
}
