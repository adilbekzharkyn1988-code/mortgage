// Типы, связанные с клиентом ипотечного брокера.
// Здесь описана карточка клиента, которую консультант заполняет
// на этапе первичной консультации.

export type MaritalStatus =
  | "single" // не женат / не замужем
  | "married" // женат / замужем
  | "divorced" // в разводе
  | "widowed"; // вдовец / вдова

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  single: "Не женат / не замужем",
  married: "Женат / замужем",
  divorced: "В разводе",
  widowed: "Вдовец / вдова",
};

export interface ExistingLoan {
  id: string;
  title: string; // например "Автокредит", "Потребительский кредит"
  monthlyPayment: number; // ежемесячный платёж, тенге
  remainingAmount?: number; // остаток долга, тенге
}

export interface Client {
  id: string;

  // Личные данные
  fullName: string;
  phone: string;
  birthDate: string; // ISO-строка даты, напр. "1990-05-14"
  city: string;
  maritalStatus: MaritalStatus;
  childrenCount: number;

  // Финансовые данные (со слов клиента на консультации)
  estimatedIncome: number; // примерный доход клиента, тенге / мес
  spouseIncome: number; // доход супруга/супруги, тенге / мес

  // Параметры сделки
  propertyValue: number; // стоимость недвижимости, тенге
  downPayment: number; // первоначальный взнос, тенге
  requiredLoanAmount: number; // необходимая сумма ипотеки, тенге

  // Текущая долговая нагрузка
  existingLoans: ExistingLoan[];
  estimatedMonthlyPayments: number; // суммарные примерные ежемесячные платежи по текущим кредитам

  // Служебные поля
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime

  // Связь с ипотечным делом (создаётся автоматически вместе с клиентом)
  caseId: string;
}

// Данные, которые вводятся в форме создания нового клиента.
// Часть полей опциональна на старте — консультант может дозаполнить позже.
export type NewClientInput = Omit<
  Client,
  "id" | "createdAt" | "updatedAt" | "caseId"
>;
