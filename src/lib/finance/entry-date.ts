export function entryDateLabel(dueDate: string | null, paidAt: string | null, timezone: string): string {
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const [year, month, day] = dueDate.split("-");
    return `${day}/${month}/${year}`;
  }
  if (paidAt) {
    const date = new Date(paidAt);
    if (!Number.isNaN(date.getTime())) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
      const [year, month, day] = parts.split("-");
      if (year && month && day) return `${day}/${month}/${year}`;
    }
  }
  return "Não informado";
}
