import { z } from "zod";

const inventoryUnitSchema = z.enum(["unidade", "ml", "g"]);
const inventoryMovementTypeSchema = z.enum(["entry", "exit", "adjustment"]);

export const inventoryUiRpcSchema = z.object({
  summary: z.object({
    products: z.number().int().nonnegative(),
    low_stock: z.number().int().nonnegative(),
    out_of_stock: z.number().int().nonnegative(),
    estimated_cost_cents: z.number().int().nonnegative(),
  }),
  products: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().nullable(),
    sku: z.string().nullable(),
    unit: inventoryUnitSchema,
    quantity: z.number().finite(),
    minimum_quantity: z.number().finite(),
    cost_cents: z.number().int().nonnegative().nullable(),
    active: z.boolean(),
    archived_at: z.string().nullable(),
    created_at: z.string().min(1),
  })),
  recent_movements: z.array(z.object({
    id: z.string().uuid(),
    product_id: z.string().uuid(),
    product_name: z.string().min(1),
    type: inventoryMovementTypeSchema,
    quantity: z.number().finite(),
    quantity_before: z.number().finite(),
    quantity_after: z.number().finite(),
    reason: z.string().nullable(),
    created_at: z.string().min(1),
  })),
});

const inventoryProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  sku: z.string().nullable(),
  unit: inventoryUnitSchema,
  quantity: z.number().finite(),
  minimumQuantity: z.number().finite(),
  costCents: z.number().int().nonnegative().nullable(),
  active: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string().min(1),
});

const inventoryMovementSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string().min(1),
  type: inventoryMovementTypeSchema,
  quantityDelta: z.number().finite(),
  label: z.string().min(1),
  occurredAt: z.string().min(1),
  note: z.string().nullable(),
});

export const inventorySnapshotSchema = z.object({
  summary: z.object({
    products: z.number().int().nonnegative(),
    lowStock: z.number().int().nonnegative(),
    outOfStock: z.number().int().nonnegative(),
    estimatedCostCents: z.number().int().nonnegative(),
  }),
  products: z.array(inventoryProductSchema),
  recentMovements: z.array(inventoryMovementSchema),
});

export type InventoryProduct = z.infer<typeof inventoryProductSchema>;
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
export type InventorySnapshot = z.infer<typeof inventorySnapshotSchema>;

export interface InventoryBackend {
  loadInventory(workspaceId: string): Promise<unknown>;
}

const movementLabels: Record<z.infer<typeof inventoryMovementTypeSchema>, string> = {
  entry: "Entrada",
  exit: "Saída",
  adjustment: "Ajuste",
};

export function adaptInventoryUiPayload(raw: unknown): InventorySnapshot {
  const payload = inventoryUiRpcSchema.parse(raw);

  return inventorySnapshotSchema.parse({
    summary: {
      products: payload.summary.products,
      lowStock: payload.summary.low_stock,
      outOfStock: payload.summary.out_of_stock,
      estimatedCostCents: payload.summary.estimated_cost_cents,
    },
    products: payload.products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      unit: product.unit,
      quantity: product.quantity,
      minimumQuantity: product.minimum_quantity,
      costCents: product.cost_cents,
      active: product.active,
      archivedAt: product.archived_at,
      createdAt: product.created_at,
    })),
    recentMovements: payload.recent_movements.map((movement) => ({
      id: movement.id,
      productId: movement.product_id,
      productName: movement.product_name,
      type: movement.type,
      quantityDelta: movement.quantity_after - movement.quantity_before,
      label: movementLabels[movement.type],
      occurredAt: movement.created_at,
      note: movement.reason,
    })),
  });
}

export function createInventoryQueries(backend: InventoryBackend) {
  return {
    async load(workspaceId: string): Promise<InventorySnapshot> {
      return adaptInventoryUiPayload(await backend.loadInventory(workspaceId));
    },
  };
}

export function summarizeInventory(snapshot: InventorySnapshot) {
  return snapshot.summary;
}
