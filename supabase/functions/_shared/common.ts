// Outils communs aux Edge Functions Pandi : CORS, réponses JSON, session du parent, client Claude.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const ALLOWED_ORIGINS = [
  "https://www.pandiflow.com",
  "https://pandiflow.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

export function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function replier(req: Request) {
  const headers = cors(req.headers.get("Origin") ?? "");
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
  return { headers, reply };
}

// Une clé d'organisation (non rattachée à un espace de travail) a besoin de l'identifiant
// d'espace de travail : secret facultatif ANTHROPIC_WORKSPACE_ID.
export function claudeClient() {
  const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
  return new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
  });
}

export function adminClient() {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  return createClient(Deno.env.get("SUPABASE_URL")!, serviceKey!, { auth: { persistSession: false } });
}

type Child = { id: string; family_id: string; look: unknown; sex?: string | null };
type Access = { child: Child; error?: undefined } | { child?: undefined; error: [string, number] };

// Le parent doit être connecté et l'enfant appartenir à sa famille
export async function parentOfChild(req: Request, admin: SupabaseClient, childId: string): Promise<Access> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return { error: ["Connecte-toi pour utiliser la photo magique.", 401] };
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return { error: ["Ta session a expiré, reconnecte-toi.", 401] };
  const { data: child } = await admin.from("children").select("id, family_id, look, sex").eq("id", childId).maybeSingle();
  const { data: member } = child
    ? await admin.from("family_members").select("user_id").eq("family_id", child.family_id).eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!child || !member) return { error: ["Enfant introuvable.", 404] };
  return { child };
}

// Plafonds du jour des appels payants : par enfant, par famille et pour toute l'app (garde-fou si
// quelqu'un crée des comptes à la chaîne). Comptés par public.take_ai_quota, en heure UTC.
//   images : images OpenAI (make-portrait) ; count : analyses photo par Claude (analyze-photo) ;
//   marks : relectures des repères par Claude (make-portrait, marksOnly)
export type QuotaKind = "images" | "count" | "marks";
export const AI_LIMITS: Record<QuotaKind, { child: number; family: number; app: number }> = {
  images: { child: 12, family: 24, app: 150 },
  count: { child: 5, family: 10, app: 100 },
  marks: { child: 12, family: 24, app: 200 },
};

const QUOTA_MESSAGES: Record<QuotaKind, Record<"enfant" | "famille", string>> = {
  images: {
    enfant: "2 séances photo par jour au maximum. On réessaie demain !",
    famille: "Votre famille a fait toutes ses séances photo du jour. On réessaie demain !",
  },
  count: {
    enfant: "5 photos magiques par jour au maximum. On réessaie demain !",
    famille: "Votre famille a fait toutes ses photos magiques du jour. On réessaie demain !",
  },
  marks: {
    enfant: "Ce personnage a déjà été relu plusieurs fois aujourd'hui. On réessaie demain !",
    famille: "Les personnages de la famille ont déjà été relus plusieurs fois aujourd'hui. On réessaie demain !",
  },
};

// Réserve un appel. null si c'est accordé, sinon [message, statut HTTP] à renvoyer tel quel.
export async function takeQuota(admin: SupabaseClient, child: { id: string; family_id: string }, kind: QuotaKind): Promise<[string, number] | null> {
  const limits = AI_LIMITS[kind];
  const { data, error } = await admin.rpc("take_ai_quota", {
    p_child: child.id,
    p_family: child.family_id,
    p_kind: kind,
    p_child_limit: limits.child,
    p_family_limit: limits.family,
    p_app_limit: limits.app,
  });
  if (error) {
    console.error(`quota ${kind}:`, error.message);
    return ["La magie n'a pas marché cette fois-ci. Réessaie dans un instant.", 500];
  }
  if (data === "enfant" || data === "famille") return [QUOTA_MESSAGES[kind][data], 429];
  if (data === "app") {
    console.error(`quota ${kind}: limite de l'app atteinte (${limits.app} par jour)`);
    return ["La magie se repose : il y a eu beaucoup de demandes aujourd'hui. On réessaie demain !", 429];
  }
  return null;
}

// Rend l'appel réservé quand il a échoué
export async function refundQuota(admin: SupabaseClient, childId: string, kind: QuotaKind) {
  const { error } = await admin.rpc("refund_ai_quota", { p_child: childId, p_kind: kind });
  if (error) console.error(`quota ${kind}: remboursement`, error.message);
}
