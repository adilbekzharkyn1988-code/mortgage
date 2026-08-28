// Типы для справочника "Банки и программы" — консультант ведёт список
// банков-партнёров и их ипотечных программ, а CRM подбирает из них
// подходящие клиенту варианты (см. lib/bankMatching.ts, lib/affordability.ts).

import { MaritalStatus } from "./client";

export interface Bank {
  id: string;
  name: string;
  note?: string; // короткая заметка консультанта (необязательно)
  createdAt: string;
  updatedAt: string;
}

export type NewBankInput = Omit<Bank, "id" | "createdAt" | "updatedAt">;

export type ProgramCategory =
  | "market" // обычная рыночная ипотека
  | "state_subsidized" // программа с господдержкой (напр. "7-20-25")
  | "young_family" // для молодой семьи
  | "large_family" // для многодетной семьи
  | "civil_servant" // для госслужащих/бюджетников
  | "refinancing"; // рефинансирование действующей ипотеки

export const PROGRAM_CATEGORY_LABELS: Record<ProgramCategory, string> = {
  market: "Рыночная ипотека",
  state_subsidized: "Господдержка",
  young_family: "Молодая семья",
  large_family: "Многодетная семья",
  civil_servant: "Госслужащие/бюджетники",
  refinancing: "Рефинансирование",
};

// Критерии подбора программы. Все поля необязательны — не заполненное поле
// означает "без ограничения по этому критерию" и не участвует в проверке
// (см. lib/bankMatching.ts — там же лежит вся логика сравнения).
export interface MortgageProgram {
  id: string;
  bankId: string;

  name: string;
  category: ProgramCategory;
  active: boolean; // неактивные программы не участвуют в подборе

  interestRatePercent: number; // ставка, % годовых
  maxTermYears: number; // максимальный срок кредита, лет

  minDownPaymentPercent: number; // минимальный первоначальный взнос, %
  minLoanAmount?: number; // ₸
  maxLoanAmount?: number; // ₸

  minHouseholdIncome?: number; // минимальный суммарный доход семьи, ₸/мес
  maxDebtToIncomeRatio?: number; // макс. допустимая долговая нагрузка (платежи/доход), %

  minBorrowerAge?: number;
  maxBorrowerAge?: number;

  minChildrenCount?: number; // для программ "многодетная семья" и т.п.
  eligibleMaritalStatuses?: MaritalStatus[]; // если пусто/не задано — без ограничения
  allowedCities?: string[]; // если пусто/не задано — без ограничения по городу

  notes?: string; // краткое описание условий для консультанта

  createdAt: string;
  updatedAt: string;
}

export type NewMortgageProgramInput = Omit<
  MortgageProgram,
  "id" | "createdAt" | "updatedAt"
>;
