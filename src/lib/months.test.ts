import { describe, expect, it } from "vitest";
import { initialState } from "./mock-data";
import { ensureMonthFinance, getAvailableMonths, getCurrentMonthValue } from "./months";

describe("dynamic month initialization", () => {
  it("formats current month from date", () => {
    expect(getCurrentMonthValue(new Date("2026-07-06T12:00:00+08:00"))).toBe("2026-07");
  });

  it("adds current month to available months before existing months", () => {
    const months = getAvailableMonths(initialState, undefined, new Date("2026-07-06T12:00:00+08:00"));
    expect(months.slice(0, 4)).toEqual(["2026-07", "2026-06", "2026-05", "2026-04"]);
  });

  it("keeps configured July six-day demo data", () => {
    const state = ensureMonthFinance(initialState, "2026-07");
    const july = state.monthlyFinance?.["2026-07"];

    expect(july?.budgetCents).toBe(165000000);
    expect(july?.averageCents).toBe(229500);
    expect(july?.projectProgress?.some((project) => project.rechargedCents > 0 || project.consumedCents > 0)).toBe(true);
    expect(state.collaborations.filter((item) => item.month === "2026-07")).toHaveLength(12);
    expect(new Set(state.collaborations.filter((item) => item.month === "2026-07").map((item) => item.plannedPublishDate))).toEqual(new Set(["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06"]));
  });

  it("creates a future empty business month from the nearest finance template", () => {
    const state = ensureMonthFinance(initialState, "2026-08");
    const august = state.monthlyFinance?.["2026-08"];
    const july = initialState.monthlyFinance?.["2026-07"];

    expect(august?.budgetCents).toBe(july?.budgetCents);
    expect(august?.averageCents).toBe(july?.averageCents);
    expect(august?.projectProgress?.map((project) => ({
      name: project.name,
      budgetCents: project.budgetCents,
      rechargedCents: project.rechargedCents,
      consumedCents: project.consumedCents,
      remainingRechargeCents: project.remainingRechargeCents,
    }))).toEqual(july?.projectProgress?.map((project) => ({
      name: project.name,
      budgetCents: project.budgetCents,
      rechargedCents: 0,
      consumedCents: 0,
      remainingRechargeCents: project.budgetCents,
    })));
    expect(state.collaborations.filter((item) => item.month === "2026-08")).toHaveLength(0);
  });
});
