"use server";

import { createClient } from "@/lib/supabase/server";
import {
  DISCOVERY_COPY,
  DISCOVERY_RPCS,
  listPublicLocalitiesWithRpc,
  searchPublicWorkspacesWithRpc,
  type DiscoveryLocality,
  type DiscoverySearchInput,
  type DiscoverySearchResult,
} from "./contract";

function rpcFromClient(supabase: Awaited<ReturnType<typeof createClient>>) {
  return async (name: string, args: Record<string, unknown>) => {
    if (name === DISCOVERY_RPCS.searchWorkspaces) {
      return supabase.rpc("search_public_workspaces", {
        p_city: (args.p_city as string | null) ?? null,
        p_state: (args.p_state as string | null) ?? null,
        p_query: (args.p_query as string | null) ?? null,
        p_postal_code: (args.p_postal_code as string | null) ?? null,
        p_limit: (args.p_limit as number | null) ?? 20,
        p_offset: (args.p_offset as number | null) ?? 0,
      });
    }
    return supabase.rpc("list_public_localities", {
      p_state: (args.p_state as string | null) ?? null,
      p_query: (args.p_query as string | null) ?? null,
      p_limit: (args.p_limit as number | null) ?? 8,
    });
  };
}

export async function searchPublicWorkspacesAction(
  input: DiscoverySearchInput,
): Promise<DiscoverySearchResult> {
  try {
    const supabase = await createClient();
    return await searchPublicWorkspacesWithRpc(rpcFromClient(supabase), input);
  } catch {
    return { status: "error", message: DISCOVERY_COPY.searchError, items: [] };
  }
}

export async function listPublicLocalitiesAction(
  query: string,
  state?: string,
): Promise<DiscoveryLocality[]> {
  const supabase = await createClient();
  return listPublicLocalitiesWithRpc(rpcFromClient(supabase), query, state);
}
