// Edge Function Supabase « make-portrait »
// Crée le visage d'un enfant façon film d'animation 3D (OpenAI GPT Image), pour une expression,
// le range dans le bucket privé « portraits », puis demande à Claude où sont les yeux et le menton :
// l'app s'en sert pour poser le visage sur le corps dessiné et y accrocher chapeaux et masques.
// La photo n'est ni stockée ni journalisée : seules les images générées sont gardées.
//
// Requête : { childId, expr: "happy" | "joy" | "encourage", image?, mediaType?, version? }
//   happy           : à partir de la photo (image en base64 + mediaType), crée une nouvelle version
//   joy / encourage : à partir du visage « happy » de cette version, pour garder le même personnage
// Réponse : { version, base, expr, marks, image } (image = le visage en webp, base64)
//
// Secrets : OPENAI_API_KEY (tools/set-openai-key.ps1) et ANTHROPIC_API_KEY (déjà utilisée par analyze-photo)

import { adminClient, claudeClient, parentOfChild, replier } from "../_shared/common.ts";

const IMAGE_MODEL = "gpt-image-2.5-sunburst";
const IMAGE_QUALITY = "medium";
const CLAUDE_MODEL = "claude-opus-5-5";
const DAILY_IMAGES = 9; // 3 séances photo (3 expressions) par enfant et par jour
const MAX_IMAGE_BASE64 = 7_000_000; // ~5 Mo
const BUCKET = "portraits";
const OPENAI_TIMEOUT_MS = 135_000; // la fonction est coupée à 150 s

const EXPRS = ["happy", "joy", "encourage"] as const;
type Expr = (typeof EXPRS)[number];

const SAME_CHARACTER =
  "This is a character from a 3D animated feature film. Keep exactly the same character: same face, hair, colors, art style and lighting, " +
  "with the same framing, size and position in the image, and the neck still going straight down to the bottom edge. ";

const PROMPTS: Record<Expr, string> = {
  happy:
    "Transform the child in this photo into a character from a 3D animated feature film, in the style of modern Pixar movies such as Ratatouille: " +
    "soft cinematic lighting, smooth skin with subtle subsurface scattering, large expressive eyes with bright highlights, appealing stylized proportions, " +
    "finely detailed hair. Keep a strong, recognizable likeness: same hairstyle and hair color, face shape, eye color, skin tone, eyebrows, " +
    "and freckles or glasses if any. Head-and-neck portrait facing the camera, centered, with the whole head and hair visible and a little empty space above the hair. " +
    "The neck goes straight down to the bottom edge of the image; nothing below the neck is visible. No hat, no accessories, no text. " +
    "Expression: a warm, gentle closed-mouth smile.",
  joy:
    SAME_CHARACTER +
    "Change only the facial expression: overjoyed, a big open-mouth laugh showing the teeth, cheeks raised, eyes happily squinting, eyebrows up.",
  encourage:
    SAME_CHARACTER +
    "Change only the facial expression: determined and encouraging, a small confident half-smile with the mouth closed, " +
    "eyebrows slightly lowered in concentration, kind and motivated eyes.",
};

// Repères du visage, en fraction de la largeur (x) ou de la hauteur (y) de l'image
const MARK_KEYS = ["eyeLeftX", "eyeLeftY", "eyeRightX", "eyeRightY", "chinY", "topY", "headLeftX", "headRightX"] as const;
type Marks = Record<(typeof MARK_KEYS)[number], number>;
const DEFAULT_MARKS: Marks = {
  eyeLeftX: 0.39, eyeLeftY: 0.46, eyeRightX: 0.61, eyeRightY: 0.46, chinY: 0.74, topY: 0.08, headLeftX: 0.2, headRightX: 0.8,
};
const MARKS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...MARK_KEYS],
  properties: Object.fromEntries(MARK_KEYS.map((k) => [k, { type: "number" }])),
};
const MARKS_PROMPT = `Cette image montre la tête d'un personnage de dessin animé, sur fond transparent.
Donne ces repères en pourcentage de la largeur (x) ou de la hauteur (y) de l'image, de 0 (bord gauche ou haut) à 100 (bord droit ou bas) :
- eyeLeftX, eyeLeftY : le centre de la pupille de l'œil situé du côté gauche de l'image ;
- eyeRightX, eyeRightY : le centre de la pupille de l'œil situé du côté droit de l'image ;
- chinY : le bas du menton ;
- topY : le point le plus haut de la tête, cheveux compris ;
- headLeftX, headRightX : les bords gauche et droit de la tête, cheveux compris, sans le cou ni les oreilles.`;

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const newVersion = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

Deno.serve(async (req) => {
  const { headers, reply } = replier(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  // 1. Vérification de la requête
  let body: { childId?: unknown; expr?: unknown; image?: unknown; mediaType?: unknown; version?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Requête invalide." }, 400);
  }
  const { childId, expr, image, mediaType, version } = body;
  if (typeof childId !== "string" || !EXPRS.includes(expr as Expr)) return reply({ error: "Requête invalide." }, 400);
  if (expr === "happy") {
    if (typeof image !== "string" || typeof mediaType !== "string") return reply({ error: "Requête invalide." }, 400);
    if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) return reply({ error: "Format de photo non pris en charge." }, 415);
    if (image.length > MAX_IMAGE_BASE64) return reply({ error: "Photo trop lourde." }, 413);
  } else if (typeof version !== "string" || !/^[a-z0-9]{6,20}$/.test(version)) {
    return reply({ error: "Requête invalide." }, 400);
  }
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return reply({ error: "La clé OpenAI n'est pas encore enregistrée dans Supabase (script tools/set-openai-key.ps1)." }, 503);

  // 2. Le parent doit être connecté et l'enfant appartenir à sa famille
  const admin = adminClient();
  const access = await parentOfChild(req, admin, childId);
  if (access.error) return reply({ error: access.error[0] }, access.error[1]);
  const { child } = access;
  const folder = `${child.family_id}/${child.id}`;
  const v = expr === "happy" ? newVersion() : (version as string);
  const base = `${folder}/${v}`;

  // 3. Image de départ : la photo, ou le visage « happy » déjà créé pour garder le même personnage
  let input: Blob;
  if (expr === "happy") {
    input = new Blob([decode(image as string)], { type: mediaType as string });
  } else {
    const { data, error } = await admin.storage.from(BUCKET).download(`${base}/happy.webp`);
    if (error || !data) return reply({ error: "Le premier visage est introuvable. Recommence la photo magique." }, 404);
    input = data;
  }

  // 4. Limite quotidienne (pour maîtriser le coût), rendue si la création échoue
  const { data: allowed, error: quotaError } = await admin.rpc("take_portrait_quota", { p_child: child.id, p_family: child.family_id, p_limit: DAILY_IMAGES });
  if (quotaError) {
    console.error("make-portrait: quota", quotaError.message);
    return reply({ error: "La magie n'a pas marché cette fois-ci. Réessaie dans un instant." }, 500);
  }
  if (!allowed) return reply({ error: "3 séances photo par jour au maximum. On réessaie demain !" }, 429);
  const refund = () => admin.rpc("refund_portrait_quota", { p_child: child.id });

  // 5. Création du visage par OpenAI
  let b64: string;
  try {
    b64 = await generate(apiKey, input, PROMPTS[expr as Expr]);
  } catch (e) {
    await refund();
    const { message, status, detail } = explain(e);
    console.error("make-portrait: échec de l'appel à OpenAI", detail);
    return reply({ error: message, detail }, status);
  }

  const bytes = decode(b64);
  const { error: upError } = await admin.storage.from(BUCKET).upload(`${base}/${expr}.webp`, bytes, { contentType: "image/webp", upsert: true });
  if (upError) {
    await refund();
    console.error("make-portrait: enregistrement", upError.message);
    return reply({ error: "Le personnage n'a pas pu être enregistré. Réessaie dans un instant." }, 500);
  }

  // 6. Repères du visage par Claude (en cas d'échec, l'app utilise un cadrage moyen)
  const marks = await findMarks(b64);

  // 7. Ménage : on ne garde que la nouvelle version et celle que l'enfant porte encore
  if (expr === "happy") {
    const current = (child.look as { portrait?: { base?: string } } | null)?.portrait?.base?.split("/")[2];
    await cleanup(admin, folder, [v, current ?? ""]).catch((e) => console.error("make-portrait: ménage", e?.message));
  }

  return reply({ version: v, base, expr, marks, image: b64 });
});

async function generate(apiKey: string, input: Blob, prompt: string, transparent = true): Promise<string> {
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("image[]", input, input.type === "image/jpeg" ? "photo.jpg" : input.type === "image/png" ? "photo.png" : "visage.webp");
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("quality", IMAGE_QUALITY);
  if (transparent) form.append("background", "transparent");
  form.append("output_format", "webp");
  form.append("output_compression", "90");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error ?? {};
    // Fond transparent refusé par le modèle : on recommence avec un fond, que l'app retire elle-même
    if (transparent && res.status === 400 && /background|transparen/i.test(err.message ?? "")) {
      return generate(apiKey, input, prompt, false);
    }
    throw Object.assign(new Error(err.message ?? "Erreur OpenAI"), { status: res.status, code: err.code, type: err.type });
  }
  const out = json?.data?.[0]?.b64_json;
  if (typeof out !== "string") throw Object.assign(new Error("Réponse OpenAI sans image"), { status: 502 });
  return out;
}

function explain(e: unknown) {
  const err = e as { status?: number; code?: string; type?: string; name?: string; message?: string };
  const text = err.message ?? "";
  const detail = `${err.status ?? ""} ${err.code ?? err.type ?? err.name ?? "erreur"}: ${text.slice(0, 240)}`.trim();
  let message = "La magie n'a pas marché cette fois-ci. Réessaie dans un instant.";
  let status = 502;
  if (err.name === "TimeoutError" || err.name === "AbortError") {
    message = "La magie a pris trop de temps. Réessaie dans un instant.";
    status = 504;
  } else if (err.status === 401) {
    message = "La clé OpenAI enregistrée dans Supabase est refusée. Vérifie-la.";
  } else if (err.status === 403 && /verif/i.test(text)) {
    message = "Ton organisation OpenAI doit d'abord être vérifiée : platform.openai.com > Settings > Organization > General > Verify Organization.";
  } else if (err.status === 403) {
    message = "OpenAI refuse l'accès au modèle d'images pour cette clé.";
  } else if (err.status === 429 && (err.code === "insufficient_quota" || /quota|billing/i.test(text))) {
    message = "Le compte OpenAI n'a plus de crédit : ajoute quelques dollars dans Settings > Billing.";
  } else if (err.status === 429) {
    message = "OpenAI est très demandé en ce moment. Réessaie dans une minute.";
    status = 503;
  } else if (err.code === "moderation_blocked" || /safety|moderation/i.test(text)) {
    message = "OpenAI a refusé cette photo. Essaie une autre photo, bien de face et bien éclairée.";
    status = 422;
  } else if (err.status === 404 || err.code === "model_not_found") {
    message = "Le modèle d'images d'OpenAI n'est pas disponible pour cette clé.";
  }
  return { message, status, detail };
}

async function findMarks(b64: string): Promise<Marks> {
  try {
    const anthropic = claudeClient();
    const response = await anthropic.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: MARKS_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/webp", data: b64 } },
            { type: "text", text: MARKS_PROMPT },
          ],
        },
      ],
    } as Parameters<typeof anthropic.beta.messages.create>[0]);
    if (response.stop_reason === "refusal") return DEFAULT_MARKS;
    const text = response.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
    return checkMarks(JSON.parse(text?.text ?? "{}"));
  } catch (e) {
    console.error("make-portrait: repères", (e as Error)?.message?.slice(0, 200));
    return DEFAULT_MARKS;
  }
}

// Les repères doivent dessiner un visage plausible, sinon on garde le cadrage moyen
function checkMarks(raw: Record<string, unknown>): Marks {
  const values = MARK_KEYS.map((k) => Number(raw[k]));
  if (values.some((n) => !Number.isFinite(n))) return DEFAULT_MARKS;
  const scale = values.every((n) => n <= 1) ? 1 : 100; // pourcentages attendus, fractions acceptées
  const m = Object.fromEntries(MARK_KEYS.map((k, i) => [k, Math.round((values[i] / scale) * 1000) / 1000])) as Marks;
  const eyeY = (m.eyeLeftY + m.eyeRightY) / 2;
  const gap = m.eyeRightX - m.eyeLeftX;
  const ok = values.every((n) => n >= 0 && n <= 100) &&
    gap > 0.06 && gap < 0.5 && Math.abs(m.eyeLeftY - m.eyeRightY) < 0.08 &&
    m.topY < eyeY && m.chinY > eyeY && m.chinY - eyeY < 0.5 &&
    m.headLeftX < m.eyeLeftX && m.headRightX > m.eyeRightX;
  return ok ? m : DEFAULT_MARKS;
}

async function cleanup(admin: ReturnType<typeof adminClient>, folder: string, keep: string[]) {
  const { data: versions } = await admin.storage.from(BUCKET).list(folder);
  for (const entry of versions ?? []) {
    if (keep.includes(entry.name)) continue;
    const { data: files } = await admin.storage.from(BUCKET).list(`${folder}/${entry.name}`);
    const paths = (files ?? []).map((f) => `${folder}/${entry.name}/${f.name}`);
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  }
}
