// Edge Function Supabase « analyze-photo »
// Reçoit la photo d'un enfant, demande à Claude de choisir les réglages de l'avatar dessiné,
// et ne renvoie que ces réglages. La photo n'est ni stockée ni journalisée.
//
// Secrets nécessaires (Supabase > Edge Functions > Secrets) :
//   ANTHROPIC_API_KEY  — ta clé API Claude
// (SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.)

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const DAILY_LIMIT = 5;
const MAX_IMAGE_BASE64 = 7_000_000; // ~5 Mo
const ALLOWED_ORIGINS = [
  "https://pandiflow.com",
  "https://www.pandiflow.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

// Vocabulaire identique à js/avatar/palette.js : toute modification doit être faite des deux côtés.
const OPTIONS = {
  face: ["rond", "ovale", "coeur", "carre"],
  skin: ["porcelaine", "clair", "beige", "dore", "miel", "caramel", "cannelle", "brun", "cacao", "ebene"],
  hair: ["court", "herisse", "frange", "raie", "boucle", "afro", "ondule", "long", "carre", "couettes", "queue", "chignon", "tresses", "rase"],
  hairColor: ["noir", "brun_fonce", "brun", "chatain", "chatain_clair", "blond_fonce", "blond", "platine", "roux", "cuivre", "bleu", "rose", "violet", "vert"],
  eyes: ["rond", "amande", "grand", "rieur"],
  eyeColor: ["marron", "noisette", "vert", "bleu", "gris", "noir"],
  brows: ["arc", "droit", "haut"],
  browThickness: ["fin", "moyen", "epais"],
  glasses: ["aucune", "rondes", "rectangle", "papillon"],
  glassesColor: ["noir", "rouge", "bleu", "rose", "ecaille", "dore"],
  outfit: ["rouge", "orange", "jaune", "vert", "turquoise", "bleu", "violet", "rose"],
};

const LOOK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...Object.keys(OPTIONS), "freckles", "dimples", "missingTooth", "notes"],
  properties: {
    ...Object.fromEntries(Object.entries(OPTIONS).map(([k, values]) => [k, { type: "string", enum: values }])),
    freckles: { type: "boolean" },
    dimples: { type: "boolean" },
    missingTooth: { type: "boolean" },
    notes: { type: "string" },
  },
};

const SYSTEM = `Tu aides PandiFlow, une application familiale, à dessiner l'avatar cartoon d'un enfant à partir d'une photo envoyée par son parent, qui a donné son accord.

Pour chaque caractéristique, choisis l'option la plus proche de ce que tu vois, uniquement parmi les valeurs autorisées :
- face : forme générale du visage.
- skin : teinte de peau, de la plus claire (porcelaine) à la plus foncée (ebene).
- hair : coiffure. "boucle" pour des boucles marquées, "afro" pour un volume crépu, "ondule" pour des cheveux ondulés mi-longs, "long" pour des cheveux lisses sous les épaules, "carre" pour une coupe au niveau de la mâchoire, "rase" pour des cheveux très courts. Cheveux attachés : "couettes", "queue", "chignon" ou "tresses".
- hairColor : couleur naturelle des cheveux (bleu, rose, violet ou vert seulement s'ils sont vraiment teints ainsi).
- eyes : "grand" pour de grands yeux ronds, "amande" pour des yeux étirés, "rieur" si l'enfant plisse les yeux en souriant, sinon "rond".
- eyeColor, brows, browThickness : yeux et sourcils.
- glasses : "aucune" si l'enfant ne porte pas de lunettes ; sinon la forme et glassesColor la couleur de la monture.
- freckles, dimples, missingTooth : taches de rousseur, fossettes, dent de lait manquante visible.
- outfit : la couleur dominante du haut porté, ramenée à la plus proche.

notes : une phrase courte et bienveillante en français, adressée à l'enfant, sur un détail sympa de son avatar (par exemple « J'ai gardé tes jolies boucles ! »). Ne décris rien d'autre, n'essaie pas d'identifier la personne et ne fais aucune supposition sur elle.
Si aucun visage d'enfant n'est visible, choisis des valeurs neutres et indique dans notes qu'il faudrait une photo de face.`;

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin") ?? "");
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  // 1. Le parent doit être connecté
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return reply({ error: "Connecte-toi pour utiliser la photo magique." }, 401);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey!, { auth: { persistSession: false } });
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return reply({ error: "Ta session a expiré, reconnecte-toi." }, 401);

  // 2. Vérification de la requête
  let body: { childId?: unknown; image?: unknown; mediaType?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Requête invalide." }, 400);
  }
  const { childId, image, mediaType } = body;
  if (typeof childId !== "string" || typeof image !== "string" || typeof mediaType !== "string") {
    return reply({ error: "Requête invalide." }, 400);
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) return reply({ error: "Format de photo non pris en charge." }, 415);
  if (image.length > MAX_IMAGE_BASE64) return reply({ error: "Photo trop lourde." }, 413);

  // 3. L'enfant doit appartenir à la famille de ce parent
  const { data: child } = await admin.from("children").select("id, family_id").eq("id", childId).maybeSingle();
  const { data: member } = child
    ? await admin.from("family_members").select("user_id").eq("family_id", child.family_id).eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!child || !member) return reply({ error: "Enfant introuvable." }, 404);

  // 4. Limite quotidienne (pour maîtriser le coût)
  const day = new Date().toISOString().slice(0, 10);
  const { data: quota } = await admin.from("photo_analyses").select("count").eq("child_id", childId).eq("day", day).maybeSingle();
  const used = quota?.count ?? 0;
  if (used >= DAILY_LIMIT) {
    return reply({ error: `${DAILY_LIMIT} photos magiques par jour au maximum. On réessaie demain !` }, 429);
  }
  await admin.from("photo_analyses").upsert(
    { child_id: childId, family_id: child.family_id, day, count: used + 1 },
    { onConflict: "child_id,day" },
  );

  // 5. Analyse par Claude
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: LOOK_SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: "Choisis les réglages de l'avatar de cet enfant." },
          ],
        },
      ],
    } as Parameters<typeof anthropic.beta.messages.create>[0]);

    if (response.stop_reason === "refusal") {
      return reply({ error: "Cette photo n'a pas pu être analysée. Essaie une autre photo ou règle le look à la main." }, 422);
    }
    const text = response.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
    if (!text?.text) return reply({ error: "La magie n'a rien donné cette fois-ci." }, 502);
    const { notes, ...look } = JSON.parse(text.text);
    return reply({ look, notes: typeof notes === "string" ? notes.slice(0, 200) : undefined });
  } catch (e) {
    // Jamais l'image dans les journaux : seulement le type d'erreur
    const err = e as { status?: number; name?: string };
    console.error("analyze-photo: échec de l'appel à Claude", err.status ?? "", err.name ?? "");
    const status = err.status === 429 || err.status === 529 ? 503 : 502;
    return reply({ error: "La magie n'a pas marché cette fois-ci. Réessaie dans un instant." }, status);
  }
});
