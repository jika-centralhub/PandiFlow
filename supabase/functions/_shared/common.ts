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
