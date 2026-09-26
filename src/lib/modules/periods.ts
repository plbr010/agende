export const PERIODS = { today: "Hoje", "7d": "7 dias", "30d": "30 dias", month: "Este mês", previous: "Mês anterior" } as const;
export type Period = keyof typeof PERIODS;
export function resolvePeriod(value: string | string[] | undefined, today: string) {
    const period: Period = typeof value === "string" && Object.hasOwn(PERIODS, value) ? value as Period : "month";
    const date = new Date(today + "T12:00:00Z");
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    let startDate = today, endDate = today;
    if (period === "7d" || period === "30d") {
        date.setUTCDate(date.getUTCDate() - (period === "7d" ? 6 : 29));
        startDate = iso(date);
    }
    if (period === "month")
        startDate = today.slice(0, 7) + "-01";
    if (period === "previous") {
        date.setUTCDate(0);
        endDate = iso(date);
        date.setUTCDate(1);
        startDate = iso(date);
    }
    return { period, startDate, endDate };
}
export function todayInTimezone(timezone: string, now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
