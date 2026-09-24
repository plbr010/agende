import { Braces, CheckCircle2, DatabaseZap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function BackendContractNotice({
  title,
  description,
  fields,
}: {
  title: string;
  description: string;
  fields: string[];
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-secondary/35">
        <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-background text-primary ring-1 ring-border">
          <DatabaseZap className="size-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="max-w-2xl leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field} className="flex items-center gap-2 rounded-2xl bg-secondary/55 px-4 py-3 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {field}
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground md:max-w-64">
          <Braces className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          O adaptador será ligado aos nomes reais do Supabase após a sincronização do contrato. Nenhum schema foi presumido.
        </div>
      </CardContent>
    </Card>
  );
}
