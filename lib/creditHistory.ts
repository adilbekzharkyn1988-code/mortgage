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
 * Кредитная линия считается ещё действующей (влияющей на текущую долговую
 * нагрузку клиента), если она явно не закрыта по статусу И по ней остаётся
 * непогашенный остаток. Закрытые и полностью погашенные линии сюда не
 * попадают — иначе "Текущие кредиты" клиента считали бы то же самое, что и
 * "действующие кредиты" по версии AI (activeCreditsCount/totalMonthlyPayment
 * в кредитной истории), только с завышенным числом за счёт закрытых
 * кредитов — из-за этого расхождение "Количество действующих кредитов" и
 * "Ежемесячные платежи по кредитам" срабатывало практически всегда.
 */
function isActiveCreditLine(item: CreditLineItem): boolean {
  if (statusLooksClosed(item.status)) return false;
  if (typeof item.remainingBalance === "number" && item.remainingBalance <= 0) return false;
  return true;
}

/**
 * Превращает кредитные линии из документа в формат "текущих кредитов" клиента.
 * Учитываются только действующие кредиты (см. isActiveCreditLine) — закрытые
 * и погашенные сюда не попадают, чтобы не искажать долговую нагрузку и не
 * расходиться с "активными" агрегатами, которые уже посчитал AI по документу.
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

export function statusLooksClosed(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("закры") || s.includes("погаш");
}

/**
 * Находит кредитные линии, где остаток задолженности равен 0, но статус в
 * отчёте не говорит явно "закрыт"/"погашен" — то есть кредит формально всё
 * ещё числится действующим. По каждой такой линии консультанту нужно
 * поручить клиенту подать заявление в ПКБ на закрытие кредита.
 */
export function detectGhostCredits(credits: CreditLineItem[]): GhostCreditFinding[] {
  return credits
    .filter(
      (item) =>
        typeof item.remainingBalance === "number" &&
        item.remainingBalance <= 0 &&
        !statusLooksClosed(item.status)
    )
    .map((item) => ({
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
