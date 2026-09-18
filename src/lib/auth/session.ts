import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canAccessPath,
  getDefaultDestination,
  getFallbackForDeniedPath,
  sanitizeNextPath,
  type AuthContext,
} from "@/lib/auth/redirects";

export type CurrentUser = {
  id: string;
  email: string;
  emailConfirmed: boolean;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "professional" | "receptionist";
};

export type SubscriptionSummary = {
  plan: "solo" | "equipe" | "salao";
  status: "trialing" | "active" | "past_due" | "expired" | "canceled";
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

export type AppSession = {
  user: CurrentUser;
  profile: {
    fullName: string;
    email: string;
    phone: string | null;
    intendedUse: "client" | "professional";
  };
  context: AuthContext;
  workspaces: WorkspaceSummary[];
  subscription: SubscriptionSummary | null;
};

export async function loadAppSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  const emailConfirmed = Boolean(user.email_confirmed_at);
  if (!emailConfirmed) {
    return {
      user: { id: user.id, email: user.email, emailConfirmed: false },
      profile: {
        fullName: "",
        email: user.email,
        phone: null,
        intendedUse: "client",
      },
      context: {
        emailConfirmed: false,
        intendedUse: null,
        hasWorkspace: false,
        hasClientProfile: false,
      },
      workspaces: [],
      subscription: null,
    };
  }

  const [
    { data: profile },
    { data: clientProfile },
    { data: memberships },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, phone, intended_use")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("client_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role, status, workspace_id, workspaces(id, name, slug)")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const workspaces: WorkspaceSummary[] = (memberships ?? []).flatMap((row) => {
    const workspace = row.workspaces;
    if (!workspace || Array.isArray(workspace)) {
      return [];
    }
    return [
      {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: row.role,
      },
    ];
  });

  let subscription: SubscriptionSummary | null = null;
  const primaryWorkspace = workspaces[0];
  if (primaryWorkspace) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status, trial_started_at, trial_ends_at, current_period_start, current_period_end")
      .eq("workspace_id", primaryWorkspace.id)
      .maybeSingle();
    if (sub) {
      subscription = {
        plan: sub.plan,
        status: sub.status,
        trialStartedAt: sub.trial_started_at,
        trialEndsAt: sub.trial_ends_at,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
      };
    }
  }

  const intendedUse = profile?.intended_use ?? "client";
  const context: AuthContext = {
    emailConfirmed: true,
    intendedUse,
    hasWorkspace: workspaces.length > 0,
    hasClientProfile: Boolean(clientProfile),
  };

  return {
    user: { id: user.id, email: user.email, emailConfirmed: true },
    profile: {
      fullName: profile?.full_name ?? "Usuário",
      email: profile?.email ?? user.email,
      phone: profile?.phone ?? null,
      intendedUse,
    },
    context,
    workspaces,
    subscription,
  };
}

export async function requireConfirmedSession(path: string): Promise<AppSession> {
  const session = await loadAppSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (!session.context.emailConfirmed) {
    redirect("/verificar-email");
  }
  if (!canAccessPath(path, session.context)) {
    redirect(getFallbackForDeniedPath(path, session.context));
  }
  return session;
}

export async function requireAnonymous(next?: string | null): Promise<void> {
  const session = await loadAppSession();
  const safeNext = sanitizeNextPath(next);
  if (session?.context.emailConfirmed) {
    if (safeNext?.startsWith("/convite/")) {
      redirect(safeNext);
    }
    redirect(getDefaultDestination(session.context));
  }
  if (session && !session.context.emailConfirmed) {
    redirect("/verificar-email");
  }
}
