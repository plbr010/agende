import { z } from "zod";

const packageSessionSchema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
  included: z.number().int().nonnegative(),
});

const packageCatalogItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  validityDays: z.number().int().positive().nullable(),
  active: z.boolean(),
  sessions: z.array(packageSessionSchema),
});

const packageUsageSchema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
  included: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
});

const clientPackageSchema = z.object({
  id: z.string().min(1),
  packageId: z.string().min(1),
  packageName: z.string().min(1),
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  purchasedAt: z.string().min(1),
  expiresAt: z.string().nullable(),
  expired: z.boolean(),
  reversedAt: z.string().nullable(),
  stateLabel: z.string().min(1),
  usage: z.array(packageUsageSchema),
});

export const packagesSnapshotSchema = z.object({
  catalog: z.array(packageCatalogItemSchema),
  clientPackages: z.array(clientPackageSchema),
});

export const sellPackageInputSchema = z.object({
  workspaceId: z.string().min(1),
  packageId: z.string().min(1),
  clientId: z.string().min(1),
});

export const reversePackageSaleInputSchema = z.object({
  workspaceId: z.string().min(1),
  clientPackageId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
});

export type PackagesSnapshot = z.infer<typeof packagesSnapshotSchema>;
export type SellPackageInput = z.infer<typeof sellPackageInputSchema>;
export type ReversePackageSaleInput = z.infer<typeof reversePackageSaleInputSchema>;

/** Adaptador normalizado; não define nomes de tabelas, funções ou enums remotos. */
export interface PackagesBackend {
  loadPackages(workspaceId: string): Promise<unknown>;
  sellPackage(input: SellPackageInput): Promise<unknown>;
  reversePackageSale(input: ReversePackageSaleInput): Promise<unknown>;
}

export function createPackagesQueries(backend: PackagesBackend) {
  return {
    async load(workspaceId: string): Promise<PackagesSnapshot> {
      return packagesSnapshotSchema.parse(await backend.loadPackages(workspaceId));
    },
    async sell(input: SellPackageInput): Promise<PackagesSnapshot> {
      const safeInput = sellPackageInputSchema.parse(input);
      return packagesSnapshotSchema.parse(await backend.sellPackage(safeInput));
    },
    async reverse(input: ReversePackageSaleInput): Promise<PackagesSnapshot> {
      const safeInput = reversePackageSaleInputSchema.parse(input);
      return packagesSnapshotSchema.parse(await backend.reversePackageSale(safeInput));
    },
  };
}

export function summarizePackages(snapshot: PackagesSnapshot) {
  const activeSales = snapshot.clientPackages.filter((sale) => !sale.expired && !sale.reversedAt);
  const remainingSessions = activeSales.reduce(
    (total, sale) => total + sale.usage.reduce((subtotal, item) => subtotal + Math.max(0, item.included - item.used), 0),
    0,
  );

  return {
    activeCatalogItems: snapshot.catalog.filter((item) => item.active).length,
    activeSales: activeSales.length,
    remainingSessions,
  };
}
