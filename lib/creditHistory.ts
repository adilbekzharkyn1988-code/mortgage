// Сопоставляет кредитные линии, извлечённые AI из кредитной истории
// (CreditLineItem, см. types/document.ts), с текущими кредитами клиента
// (ExistingLoan, см. types/client.ts) — чтобы консультанту не нужно было
// вручную перепечатывать каждый кредит после загрузки кредитной истории.

import { ExistingLoan } from "@/types/client";
import { CreditLineItem } from "@/types/document";

function generateLoanId(): string {
  return `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function creditTitle(item: CreditLineItem): string {
  const parts = [item.creditor, item.type].filter(
    (v): v is string => Boolean(v && v.trim().length > 0)
  );
  return parts.length > 0 ? parts.join(" — ") : "Кредит (из кредитной истории)";
}

/**
 * Фаза обязательства ("Действующий"/"Завершен" и т.п.) — это ЕДИНСТВЕННЫЙ
 * надёжный признак того, открыт кредит или закрыт. "status" (см.
 * paymentStatusLooksClosed ниже) — это платёжный статус договора
 * ("Стандартные кредиты", "Просроченный") и НЕ говорит о том, закрыт ли
 * кредит: завершённый кредит вполне может иметь статус "Просроченный".
 */
export function phaseLooksClosed(phase: string | null): boolean {
  if (!phase) return false;
  const p = phase.toLowerCase();
  return p.includes("заверш") || p.includes("закры");
}

/**
 * Платёжный статус договора ("Стандартные кредиты", "Просроченный" и т.п.) —
 * запасной вариант для isActiveCreditLine, когда поля "phase" в документе нет
 * (старые confirmedFields). НЕ путать с фазой: платёжный статус сам по себе
 * не говорит, закрыт кредит или нет.
 */
function paymentStatusLooksClosed(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("закры") || s.includes("погаш");
}

/**
 * Кредитная линия считается ещё действующей, если её ФАЗА (не платёжный
 * статус) явно не говорит о завершении. ВАЖНО: остаток задолженности здесь
 * больше не проверяется — карта/кредит с фазой "Действующий", но нулевым
 * текущим остатком (например, кредитная карта, которой сейчас не
 * пользуются), всё равно остаётся действующим обязательством с точки зрения
 * кредитного бюро. Раньше это приводило к ложному расхождению "Количество
 * действующих кредитов" (см. lib/matching.ts) — Gemini в activeCreditsCount
 * считал такие карты, а этот фильтр их отбрасывал из-за нулевого остатка.
 *
 * Для документов, проанализированных ДО того, как в промпт добавили поле
 * "phase" (старые confirmedFields без него), используем платёжный статус как
 * запасной вариант — это лучше, чем считать все такие кредиты активными.
 */
function isActiveCreditLine(item: CreditLineItem): boolean {
  if (item.phase) return !phaseLooksClosed(item.phase);
  return !paymentStatusLooksClosed(item.status);
}

/** Кредит "погашен, но не закрыт в бюро": фаза говорит "действующий", но
 *  остаток задолженности уже нулевой — то же, что и detectGhostCredits ниже,
 *  но как булева проверка одной линии (используется в UI для бейджа). */
function isPaidOffButNotClosed(item: CreditLineItem): boolean {
  return (
    isActiveCreditLine(item) &&
    typeof item.remainingBalance === "number" &&
    item.remainingBalance <= 0
  );
}

/**
 * Раскладывает кредитные линии на три группы для UI (см.
 * DocumentAnalysisModal): действующие (в т.ч. "кредиты-призраки" — погашенные
 * по факту, но не закрытые в бюро) и завершённые.
 */
export function classifyCreditLines(credits: CreditLineItem[]): {
  active: CreditLineItem[];
  closed: CreditLineItem[];
} {
  const active: CreditLineItem[] = [];
  const closed: CreditLineItem[] = [];
  for (const item of credits) {
    (isActiveCreditLine(item) ? active : closed).push(item);
  }
  return { active, closed };
}

export { isActiveCreditLine, isPaidOffButNotClosed };

/**
 * Превращает кредитные линии из документа в формат "текущих кредитов" клиента.
 * Учитываются только кредиты с фазой "действующий" (см. isActiveCreditLine) —
 * завершённые сюда не попадают. "Кредиты-призраки" (действующие по фазе, но
 * с нулевым остатком — см. detectGhostCredits) НАМЕРЕННО включаются: бюро
 * всё ещё считает их открытыми обязательствами, и именно поэтому по ним
 * заводится отдельная задача на закрытие в ПКБ, а не молчаливое исключение.
 * Платёж и остаток берутся как есть из документа; если поле не найдено —
 * платёж считается 0 (а не выдумывается), остаток остаётся не указан.
 */
export function mapCreditsToExistingLoans(credits: CreditLineItem[]): ExistingLoan[] {
  return credits.filter(isActiveCreditLine).map((item) => ({
    id: generateLoanId(),
    title: creditTitle(item),
    monthlyPayment: item.monthlyPayment ?? 0,
    remainingAmount: item.remainingBalance ?? undefined,
  }));
}

export function sumMonthlyPayments(loans: ExistingLoan[]): number {
  return loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
}

// ============================================================================
// "Кредиты-призраки": числятся действующими в отчёте ПКБ, но остаток по ним
// уже 0. Причина обычно в том, что заёмщик погасил долг перед банком, но не
// подал в ПКБ отдельное заявление о закрытии кредита — банк не делает это
// автоматически. Из-за этого кредит продолжает висеть "активным" в кредитной
// истории и может портить расчёт долговой нагрузки / решение банка по заявке,
// хотя реального долга нет. Это чисто механическая проверка по уже
// извлечённым полям (remainingBalance/status) — AI здесь ничего не решает.
// ============================================================================

export interface GhostCreditFinding {
  creditor: string;
  type: string | null;
  monthlyPayment: number | null;
  status: string | null;
}

/**
 * Находит кредитные линии, где остаток задолженности равен 0, но ФАЗА
 * обязательства не говорит о завершении — то есть кредит формально всё ещё
 * числится действующим. По каждой такой линии консультанту нужно поручить
 * клиенту подать заявление в ПКБ на закрытие кредита.
 *
 * ВАЖНО: раньше здесь проверялся платёжный статус ("Стандартные кредиты" /
 * "Просроченный"), а не фаза — из-за этого под "кредит-призрак" ошибочно
 * попадали и обычные ЗАВЕРШЁННЫЕ кредиты с нулевым остатком (что для
 * завершённых кредитов совершенно нормально), потому что платёжный статус
 * никогда явно не пишет "закрыт"/"погашен".
 */
export function detectGhostCredits(credits: CreditLineItem[]): GhostCreditFinding[] {
  return credits.filter(isPaidOffButNotClosed).map((item) => ({
    creditor: item.creditor || "Кредитор не указан",
    type: item.type,
    monthlyPayment: item.monthlyPayment,
    status: item.status,
  }));
}

/** Заголовок/описание задачи для консультанта по одному найденному "кредиту-призраку". */
export function ghostCreditRecommendation(finding: GhostCreditFinding): {
  title: string;
  description: string;
} {
  const label = [finding.creditor, finding.type].filter(Boolean).join(" — ");
  return {
    title: `Закрыть кредит в ПКБ: ${label}`,
    description:
      `По данным кредитной истории остаток задолженности по этому кредиту — 0, ` +
      `но в отчёте он всё ещё числится действующим` +
      (finding.status ? ` (статус: «${finding.status}»)` : "") +
      `. Вероятная причина — клиент погасил долг перед банком, но не подал ` +
      `отдельное заявление в ПКБ о закрытии кредита. Нужно поручить клиенту ` +
      `обратиться в ПКБ (Первое кредитное бюро) с заявлением о закрытии — иначе ` +
      `кредит будет учитываться как активный при рассмотрении заявки банком.`,
  };
}
