import { z } from "zod";

const clientPackageStatusSchema = z.enum(["active", "exhausted", "cancelled", "expired"]);

export const packagesUiRpcSchema = z.object({
  catalog: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().nullable(),
    price_cents: z.number().int().nonnegative(),
    validity_days: z.number().int().positive().nullable(),
    active: z.boolean(),
    archived_at: z.string().nullable(),
    items: z.array(z.object({
      service_id: z.string().uuid(),
      service_name: z.string().min(1),
      quantity: z.number().int().positive(),
    })),
  })),
  sales: z.array(z.object({
    id: z.string().uuid(),
    client_id: z.string().uuid(),
    client_name: z.string().min(1),
    package_id: z.string().uuid(),
    package_name_snapshot: z.string().min(1),
    price_cents: z.number().int().nonnegative(),
    purchased_at: z.string().min(1),
    expires_at: z.string().nullable(),
    status: clientPackageStatusSchema,
    included_total: z.number().int().nonnegative(),
    used_total: z.number().int().nonnegative(),
  })),
});

const packageSessionSchema = z.object({
  serviceId: z.string().uuid(),
  serviceName: z.string().min(1),
  included: z.number().int().nonnegative(),
});

const packageCatalogItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  validityDays: z.number().int().positive().nullable(),
  active: z.boolean(),
  archivedAt: z.string().nullable(),
  sessions: z.array(packageSessionSchema),
});

const clientPackageSchema = z.object({
  id: z.string().uuid(),
  packageId: z.string().uuid(),
  packageName: z.string().min(1),
  clientId: z.string().uuid(),
  clientName: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  purchasedAt: z.string().min(1),
  expiresAt: z.string().nullable(),
  status: clientPackageStatusSchema,
  includedTotal: z.number().int().nonnegative(),
  usedTotal: z.number().int().nonnegative(),
});

export const packagesSnapshotSchema = z.object({
  catalog: z.array(packageCatalogItemSchema),
  sales: z.array(clientPackageSchema),
});

export const sellPackageInputSchema = z.object({
  workspaceId: z.string().min(1),
  packageId: z.string().min(1),
  clientId: z.string().min(1),
});

export const cancelClientPackageInputSchema = z.object({
  workspaceId: z.string().min(1),
  clientPackageId: z.string().min(1),
});

export const reversePackageRedemptionInputSchema = z.object({
  workspaceId: z.string().min(1),
  redemptionId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

const reversePackageRedemptionResultSchema = z.object({
  redemption_id: z.string().uuid(),
  client_package_id: z.string().uuid(),
  appointment_id: z.string().uuid(),
  package_status: clientPackageStatusSchema,
  remaining_after_reversal: z.number().int().nonnegative(),
});

export type PackagesSnapshot = z.infer<typeof packagesSnapshotSchema>;
export type SellPackageInput = z.infer<typeof sellPackageInputSchema>;
export type CancelClientPackageInput = z.infer<typeof cancelClientPackageInputSchema>;
export type ReversePackageRedemptionInput = z.infer<typeof reversePackageRedemptionInputSchema>;

export interface PackagesBackend {
  loadPackages(workspaceId: string): Promise<unknown>;
  sellPackage(input: SellPackageInput): Promise<unknown>;
  cancelClientPackage(input: CancelClientPackageInput): Promise<unknown>;
  reversePackageRedemption(input: ReversePackageRedemptionInput): Promise<unknown>;
}

export function adaptPackagesUiPayload(raw: unknown): PackagesSnapshot {
  const payload = packagesUiRpcSchema.parse(raw);

  return packagesSnapshotSchema.parse({
    catalog: payload.catalog.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      priceCents: item.price_cents,
      validityDays: item.validity_days,
      active: item.active,
      archivedAt: item.archived_at,
      sessions: item.items.map((session) => ({
        serviceId: session.service_id,
        serviceName: session.service_name,
        included: session.quantity,
      })),
    })),
    sales: payload.sales.map((sale) => ({
      id: sale.id,
      packageId: sale.package_id,
      packageName: sale.package_name_snapshot,
      clientId: sale.client_id,
      clientName: sale.client_name,
      priceCents: sale.price_cents,
      purchasedAt: sale.purchased_at,
      expiresAt: sale.expires_at,
      status: sale.status,
      includedTotal: sale.included_total,
      usedTotal: sale.used_total,
    })),
  });
}

export function createPackagesQueries(backend: PackagesBackend) {
  return {
    async load(workspaceId: string): Promise<PackagesSnapshot> {
      return adaptPackagesUiPayload(await backend.loadPackages(workspaceId));
    },
    async sell(input: SellPackageInput): Promise<string> {
      const safeInput = sellPackageInputSchema.parse(input);
      return z.string().uuid().parse(await backend.sellPackage(safeInput));
    },
    async cancel(input: CancelClientPackageInput): Promise<string> {
      const safeInput = cancelClientPackageInputSchema.parse(input);
      return z.string().uuid().parse(await backend.cancelClientPackage(safeInput));
    },
    async reverseRedemption(input: ReversePackageRedemptionInput) {
      const safeInput = reversePackageRedemptionInputSchema.parse(input);
      return reversePackageRedemptionResultSchema.parse(await backend.reversePackageRedemption(safeInput));
    },
  };
}

export function summarizePackages(snapshot: PackagesSnapshot) {
  const activeSales = snapshot.sales.filter((sale) => sale.status === "active");
  const remainingSessions = activeSales.reduce(
    (total, sale) => total + Math.max(0, sale.includedTotal - sale.usedTotal),
    0,
  );

  return {
    activeCatalogItems: snapshot.catalog.filter((item) => item.active).length,
    activeSales: activeSales.length,
    remainingSessions,
  };
}
