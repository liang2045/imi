import { initialState } from "./mock-data";
import type { AppState, MonthlyProjectFinance } from "./types";

export function getCurrentMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function resetProjectProgressForNewMonth(projects?: MonthlyProjectFinance[]) {
  return (projects || []).map((project) => ({
    ...project,
    rechargedCents: 0,
    consumedCents: 0,
    remainingRechargeCents: project.budgetCents,
  }));
}

export function findNearestFinanceTemplate(monthlyFinance: AppState["monthlyFinance"], targetMonth: string) {
  const entries = Object.entries(monthlyFinance || {}).filter(([month]) => month !== targetMonth).sort(([a], [b]) => b.localeCompare(a));
  return entries.find(([month]) => month < targetMonth)?.[1] || entries[0]?.[1];
}

export function ensureMonthFinance(state: AppState, targetMonth = getCurrentMonthValue()): AppState {
  if (state.monthlyFinance?.[targetMonth]) return state;
  const template = findNearestFinanceTemplate(state.monthlyFinance, targetMonth) || findNearestFinanceTemplate(initialState.monthlyFinance, targetMonth);
  return {
    ...state,
    monthlyFinance: {
      ...state.monthlyFinance,
      [targetMonth]: {
        budgetCents: template?.budgetCents ?? state.budgetCents,
        averageCents: template?.averageCents,
        projectProgress: resetProjectProgressForNewMonth(template?.projectProgress),
      },
    },
  };
}

export function getAvailableMonths(state: AppState, selectedMonth?: string, date = new Date()) {
  const currentMonth = getCurrentMonthValue(date);
  return Array.from(new Set([
    currentMonth,
    selectedMonth,
    ...Object.keys(initialState.monthlyFinance || {}),
    ...Object.keys(state.monthlyFinance || {}),
    ...state.collaborations.map((item) => item.month),
  ].filter(Boolean) as string[])).sort((a, b) => b.localeCompare(a));
}
