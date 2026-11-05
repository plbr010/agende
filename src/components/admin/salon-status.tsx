import { SALON_STATUS, salonStatus } from "@/lib/admin/salon-status";
export function SalonStatusBadge({ value }: { value: unknown }) {
  const status = salonStatus(value);
  const tone = status === "paid" ? "bg-emerald-50 text-emerald-900" :
    status === "past_due" || status === "unpaid" ? "bg-red-50 text-red-900" :
    status === "trial" ? "bg-primary/10 text-wine-deep" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{SALON_STATUS[status]}</span>;
}
