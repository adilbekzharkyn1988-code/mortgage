# MortgageDesk — CRM для ипотечных брокеров (MVP-0)

Тестовый прототип CRM, который ведёт консультанта и клиента от первичной
консультации до формирования ипотечного досье.

## Стек

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Данные: localStorage + mock data (сервисный слой уже спроектирован под
  будущую замену на Supabase — см. «Что дальше»)
- AI-анализ: Gemini API (будет подключён на ЭТАПЕ 2)

## Как запустить

```bash
npm install
npm run dev
```

Открыть [http://localhost:3000](http://localhost:3000) — приложение
автоматически перенаправит на `/dashboard`.

Для продакшен-сборки:

```bash
npm run build
npm run start
```

### GitHub Codespaces

Проект не требует специальной настройки — после открытия Codespace
достаточно выполнить `npm install && npm run dev` и открыть проброшенный
порт 3000.

### Vercel

Импортировать репозиторий в Vercel как обычный Next.js проект —
дополнительная конфигурация не требуется. Framework Preset определится
автоматически.

> Обратите внимание: шрифты (PT Serif, IBM Plex Sans, IBM Plex Mono)
> подключены через `next/font/google` и загружаются во время сборки —
> для этого нужен доступ в интернет (есть и в Codespaces, и на Vercel).

## Реализовано на ЭТАПЕ 1

- Структура Next.js проекта (App Router) по согласованной схеме.
- Базовый layout (`app/layout.tsx`) с подключёнными шрифтами и
  дизайн-токенами (`app/globals.css`).
- Адаптивное левое меню (`components/Sidebar.tsx`, `components/AppShell.tsx`)
  с мобильным drawer-меню.
- Dashboard (`app/dashboard`) — сводная статистика по клиентам и делам,
  список клиентов, требующих внимания.
- Страница «Клиенты» (`app/clients`) — список с поиском, прогрессом дела
  и индикаторами рисков.
- Страница «Новый клиент» (`app/clients/new`) — полная форма создания
  клиента; при сохранении автоматически создаётся ипотечное дело на
  этапе «Консультация».
- Карточка клиента (`app/clients/[id]`) — все поля из ТЗ, этап и прогресс
  дела (визуальный степпер), баннер «следующее действие» /
  предупреждение об его отсутствии, блок обнаруженных несоответствий,
  список текущих кредитов.
- Mock-данные (`data/mockClients.ts`, `data/mockCases.ts`, `data/mockTasks.ts`).
- Сервисный слой на localStorage (`lib/services/*`) со строгим
  интерфейсом `StorageAdapter<T>` (`lib/services/storageAdapter.ts`),
  спроектированным так, чтобы на следующем этапе подставить
  `SupabaseAdapter<T>` без изменений в компонентах.
- TypeScript-типы для всех сущностей (`types/*`).
- Заглушки AI-слоя (`lib/services/aiService.ts`, `lib/ai/*`) — интерфейс
  зафиксирован, реализация появится на ЭТАПЕ 2.

## Структура проекта

```
/app
  /dashboard          Dashboard
  /clients            Список клиентов
  /clients/new        Форма создания клиента
  /clients/[id]       Карточка клиента
  layout.tsx          Корневой layout + шрифты
  globals.css         Дизайн-токены (Tailwind v4 @theme)
/components
  AppShell.tsx        Общий каркас (сайдбар + мобильное меню)
  Sidebar.tsx          Левое меню
  CaseStageStepper.tsx Степпер этапов ипотечного дела
  NextActionBanner.tsx Баннер "следующее действие"
  ProgressBar.tsx
  StatCard.tsx
  ClientListRow.tsx
  /ui                  Базовые примитивы (Button, Card, Badge, FormField…)
/lib
  format.ts            Форматирование денег/дат
  aggregations.ts       Соединение клиентов/дел/задач для UI
  /services
    storageAdapter.ts   Универсальный интерфейс хранилища (localStorage → Supabase)
    clientService.ts
    caseService.ts
    documentService.ts
    taskService.ts
    aiService.ts        Заглушка — реализация на ЭТАПЕ 2
  /ai
    gemini.ts            Заглушка
    prompts.ts            Заглушка
    documentAnalysis.ts   Заглушка
    caseAnalysis.ts       Заглушка
/types
  client.ts
  mortgageCase.ts
  document.ts
  task.ts
/data
  mockClients.ts
  mockCases.ts
  mockTasks.ts
```

## Что дальше — ЭТАП 2

1. Подключить Gemini API (`lib/ai/gemini.ts`) и реализовать промпты
   (`lib/ai/prompts.ts`) для анализа документа и анализа досье.
2. Страница «Документы» — загрузка файлов консультантом по типам
   (удостоверение личности, справка о доходах, кредитная история и т.д.).
3. Страница «AI-анализ документа» — запуск анализа, отображение
   извлечённых полей, кнопки «Подтвердить данные» / «Исправить» /
   «Отменить».
4. Логика сопоставления данных из разных источников (например, доход по
   консультации vs доход по справке) и автоматическое создание
   `Discrepancy` в деле.
5. Страница «AI-анализ досье» — сводный анализ (что подтверждено, чего
   не хватает, несоответствия, риски, рекомендации) с осторожными
   формулировками и без категоричных выводов.
6. Страница «План действий» — превращение рекомендаций AI в задачи
   (`taskService.create`), управление статусами задач.
7. (Опционально, за пределами MVP-0) `SupabaseAdapter<T>`, реализующий
   `StorageAdapter<T>`, для перехода с localStorage на реальную БД.
