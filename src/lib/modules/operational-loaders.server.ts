import "server-only";

import { createOperationalModuleLoaders } from "@/lib/modules/operational-loaders";
import { supabaseOperationalAdapters } from "@/lib/modules/supabase-operational-adapters.server";

export const operationalModuleLoaders = createOperationalModuleLoaders(supabaseOperationalAdapters);
