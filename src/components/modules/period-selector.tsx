import { PERIODS, type Period } from "@/lib/modules/periods";
import { Button } from "@/components/ui/button";

export function PeriodSelector({ period, startDate, endDate }: {
    period: Period;
    startDate: string;
    endDate: string;
}) {
    return (
      <form className="agende-panel mb-5 flex flex-wrap items-end gap-3 rounded-[1.25rem] p-4 ring-1 ring-[#f0e4de]">
        <label className="grid min-w-40 flex-1 gap-1 text-sm">
          Período
          <select name="period" defaultValue={period} className="h-11 rounded-xl border border-input bg-background px-3">
            {Object.entries(PERIODS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
        <Button type="submit" className="h-11">Mostrar</Button>
        <p className="text-sm text-muted-foreground">{startDate.split("-").reverse().join("/")} a {endDate.split("-").reverse().join("/")}</p>
      </form>
    );
}
