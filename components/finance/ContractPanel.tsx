"use client";

// ЭТАП 5, п.5.8–5.9: договор в карточке ипотечного дела.
// Не реализует ЭЦП, электронное подписание, автогенерацию или отправку
// клиенту — только хранение метаданных договора и статуса (см. п.5.8 ТЗ).

import { useEffect, useRef, useState } from "react";
import { FileSignature, Paperclip, Pencil, Upload } from "lucide-react";
import {
  CONTRACT_STATUS_LABELS,
  Contract,
  ContractStatus,
} from "@/types/finance";
import { contractService } from "@/lib/services/contractService";
import { timelineService } from "@/lib/services/timelineService";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, SelectInput, TextInput } from "@/components/ui/FormField";
import { formatDate, formatTenge } from "@/lib/format";

const STATUS_BADGE_TONE: Record<ContractStatus, "neutral" | "navy" | "success" | "risk"> = {
  draft: "neutral",
  active: "navy",
  completed: "success",
  cancelled: "risk",
};

interface ContractFormState {
  contractNumber: string;
  contractDate: string;
  serviceName: string;
  totalAmount: string;
}

const EMPTY_FORM: ContractFormState = {
  contractNumber: "",
  contractDate: new Date().toISOString().slice(0, 10),
  serviceName: "Юридическое сопровождение ипотечной сделки",
  totalAmount: "",
};

export function ContractPanel({
  caseId,
  onContractChange,
}: {
  caseId: string;
  onContractChange?: (contract: Contract | null) => void;
}) {
  const [contract, setContract] = useState<Contract | null | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ContractFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // Файл договора текущей сессии — как и для документов клиента, само
  // содержимое файла не переживает перезагрузку страницы (п.15 ТЗ),
  // постоянно хранится только имя файла.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const contracts = await contractService.getByCaseId(caseId);
    const current = contracts[0] ?? null;
    setContract(current);
    onContractChange?.(current);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const contracts = await contractService.getByCaseId(caseId);
      if (cancelled) return;
      const current = contracts[0] ?? null;
      setContract(current);
      onContractChange?.(current);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(current: Contract) {
    setForm({
      contractNumber: current.contractNumber,
      contractDate: current.contractDate.slice(0, 10),
      serviceName: current.serviceName,
      totalAmount: String(current.totalAmount),
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit() {
    const amount = Number(form.totalAmount);
    if (!form.contractNumber.trim()) {
      setFormError("Укажите номер договора.");
      return;
    }
    if (!form.contractDate) {
      setFormError("Укажите дату договора.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Стоимость услуг должна быть больше нуля.");
      return;
    }

    if (contract) {
      await contractService.update(contract.id, {
        contractNumber: form.contractNumber.trim(),
        contractDate: form.contractDate,
        serviceName: form.serviceName.trim(),
        totalAmount: amount,
      });
      await timelineService.addEvent(
        caseId,
        "contract_updated",
        `Изменён договор № ${form.contractNumber.trim()}`
      );
    } else {
      const created = await contractService.create({
        caseId,
        contractNumber: form.contractNumber.trim(),
        contractDate: form.contractDate,
        serviceName: form.serviceName.trim(),
        totalAmount: amount,
        currency: "KZT",
        fileName: pendingFile?.name,
      });
      if (created.status === "draft") {
        // Договор создаётся черновиком — сразу активируем, т.к. на MVP-0
        // нет отдельного шага согласования (соответствует статусам п.5.9).
        await contractService.setStatus(created.id, "active");
      }
      await timelineService.addEvent(
        caseId,
        "contract_created",
        `Создан договор № ${form.contractNumber.trim()}`
      );
    }

    setShowForm(false);
    await reload();
  }

  async function handleStatusChange(status: ContractStatus) {
    if (!contract) return;
    await contractService.setStatus(contract.id, status);
    await timelineService.addEvent(
      caseId,
      "contract_status_changed",
      `Статус договора изменён на «${CONTRACT_STATUS_LABELS[status]}»`
    );
    await reload();
  }

  async function handleFileChosen(file: File) {
    if (!contract) return;
    setPendingFile(file);
    await contractService.update(contract.id, { fileName: file.name });
    await timelineService.addEvent(
      caseId,
      "contract_updated",
      `Заменён файл договора: ${file.name}`
    );
    await reload();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openAttachedFile() {
    if (!pendingFile) return;
    const url = URL.createObjectURL(pendingFile);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (contract === undefined) {
    return null;
  }

  return (
    <Card>
      <CardHeader eyebrow="Ипотечное дело" title="Договор" />
      <div className="flex flex-col gap-4 p-5">
        {!contract && !showForm && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink-soft">Договор ещё не прикреплён.</p>
            <Button variant="primary" onClick={openCreateForm}>
              <FileSignature size={15} />
              Добавить договор
            </Button>
          </div>
        )}

        {contract && !showForm && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  Договор № {contract.contractNumber}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  от {formatDate(contract.contractDate)} · {contract.serviceName}
                </p>
              </div>
              <Badge tone={STATUS_BADGE_TONE[contract.status]}>
                {CONTRACT_STATUS_LABELS[contract.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
                <p className="text-xs text-ink-faint">Стоимость услуг</p>
                <p className="mt-1 font-data text-lg text-ink">
                  {formatTenge(contract.totalAmount)}
                </p>
              </div>
              <FieldWrapper label="Статус договора" htmlFor="contract-status">
                <SelectInput
                  id="contract-status"
                  value={contract.status}
                  onChange={(e) => handleStatusChange(e.target.value as ContractStatus)}
                >
                  {(Object.entries(CONTRACT_STATUS_LABELS) as [ContractStatus, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </SelectInput>
              </FieldWrapper>
            </div>

            {contract.fileName && (
              <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                <Paperclip size={13} />
                {contract.fileName}
                {!pendingFile && " · файл сессии недоступен после перезагрузки страницы"}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => openEditForm(contract)}>
                <Pencil size={14} />
                Редактировать
              </Button>
              {contract.fileName && (
                <Button variant="ghost" onClick={openAttachedFile} disabled={!pendingFile}>
                  Открыть договор
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChosen(file);
                }}
              />
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />
                {contract.fileName ? "Заменить файл" : "Прикрепить файл"}
              </Button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="flex flex-col gap-4 rounded-lg border border-line-strong p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldWrapper label="Номер договора" htmlFor="contract-number" required>
                <TextInput
                  id="contract-number"
                  value={form.contractNumber}
                  onChange={(e) => setForm((f) => ({ ...f, contractNumber: e.target.value }))}
                  placeholder="25/08-01"
                />
              </FieldWrapper>
              <FieldWrapper label="Дата договора" htmlFor="contract-date" required>
                <TextInput
                  id="contract-date"
                  type="date"
                  value={form.contractDate}
                  onChange={(e) => setForm((f) => ({ ...f, contractDate: e.target.value }))}
                />
              </FieldWrapper>
              <FieldWrapper label="Наименование услуги" htmlFor="contract-service">
                <TextInput
                  id="contract-service"
                  value={form.serviceName}
                  onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
                />
              </FieldWrapper>
              <FieldWrapper label="Стоимость услуг, ₸" htmlFor="contract-amount" required>
                <TextInput
                  id="contract-amount"
                  type="number"
                  min={1}
                  value={form.totalAmount}
                  onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
                  placeholder="500000"
                />
              </FieldWrapper>
            </div>

            {!contract && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                />
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} />
                  {pendingFile ? pendingFile.name : "Прикрепить файл договора"}
                </Button>
              </div>
            )}

            {formError && <p className="text-xs text-risk">{formError}</p>}

            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSubmit}>
                Сохранить
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
