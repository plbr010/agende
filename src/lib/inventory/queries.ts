import { z } from "zod";

const inventoryProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().finite(),
  minimumQuantity: z.number().finite(),
  costCents: z.number().int().nonnegative(),
  updatedAt: z.string().min(1),
});

const inventoryMovementSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantityDelta: z.number().finite(),
  label: z.string().min(1),
  occurredAt: z.string().min(1),
  note: z.string().nullable(),
});

export const inventorySnapshotSchema = z.object({
  products: z.array(inventoryProductSchema),
  recentMovements: z.array(inventoryMovementSchema),
});

export type InventoryProduct = z.infer<typeof inventoryProductSchema>;
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
export type InventorySnapshot = z.infer<typeof inventorySnapshotSchema>;

/**
 * Fronteira entre a UI e o backend remoto. O adaptador Supabase deve apenas
 * normalizar a resposta real para este formato; nomes de tabelas e RPCs não
 * pertencem a esta camada e só serão adicionados depois da sincronização.
 */
export interface InventoryBackend {
  loadInventory(workspaceId: string): Promise<unknown>;
}

export function createInventoryQueries(backend: InventoryBackend) {
  return {
    async load(workspaceId: string): Promise<InventorySnapshot> {
      const raw = await backend.loadInventory(workspaceId);
      return inventorySnapshotSchema.parse(raw);
    },
  };
}

export function summarizeInventory(snapshot: InventorySnapshot) {
  const lowStock = snapshot.products.filter((product) => product.quantity <= product.minimumQuantity);
  const totalCostCents = snapshot.products.reduce(
    (total, product) => total + Math.round(product.quantity * product.costCents),
    0,
  );

  return {
    products: snapshot.products.length,
    lowStock: lowStock.length,
    totalCostCents,
  };
}
