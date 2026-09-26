import { PERIODS, type Period } from "@/lib/modules/periods";
export function PeriodSelector({ period, startDate, endDate }: {
    period: Period;
    startDate: string;
    endDate: string;
}) {
    return <form className="mb-5 flex flex-wrap items-end gap-3">
    <label className="grid gap-1 text-sm">Período<select name="period" defaultValue={period} className="rounded-lg border bg-background p-2">{Object.entries(PERIODS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
    </label>
    <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Aplicar período</button>
    <p className="text-sm text-muted-foreground">{startDate.split("-").reverse().join("/")} a {endDate.split("-").reverse().join("/")}</p>
    </form>;
}
