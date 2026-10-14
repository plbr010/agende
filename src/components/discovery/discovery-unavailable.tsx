import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DiscoveryPublicationUnavailable() {
  return (
    <Card className="border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle>Aparecer na busca de salões</CardTitle>
        <CardDescription>
          A publicação na busca ainda não está disponível neste ambiente. Nada foi inventado nesta tela.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p role="status" className="text-sm text-muted-foreground">
          Quando o sistema de busca estiver no ar, você poderá publicar o salão por aqui. Até lá, envie o link
          público para as clientes.
        </p>
      </CardContent>
    </Card>
  );
}
