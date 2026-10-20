// Edge Function Supabase « make-portrait »
// Crée le visage d'un enfant façon film d'animation 3D (OpenAI GPT Image), pour une expression,
// le range dans le bucket privé « portraits », puis demande à Claude où sont les yeux et le menton :
// l'app s'en sert pour poser le visage sur le corps dessiné et y accrocher chapeaux et masques.
// La photo n'est ni stockée ni journalisée : seules les images générées sont gardées.
// Si OpenAI refuse la photo, Claude la décrit et OpenAI dessine d'après ce texte seul.
// Chaque demande est notée dans public.portrait_runs (durée, modèle, erreur ; jamais d'image).
//
// Requête : { childId, expr: "happy" | "joy" | "encourage", image?, mediaType?, version? }
//   happy           : à partir de la photo (image en base64 + mediaType), crée une nouvelle version
//   joy / encourage : à partir du visage « happy » de cette version, pour garder le même personnage
// Réponse : { version, base, expr, marks, image } (image = le visage en webp, base64)
//
// Secrets : OPENAI_API_KEY (tools/set-openai-key.ps1) et ANTHROPIC_API_KEY (déjà utilisée par analyze-photo)

import { adminClient, claudeClient, parentOfChild, replier } from "../_shared/common.ts";

// Du plus récent au plus ancien : si le compte n'a pas accès à un modèle, on essaie le suivant
const IMAGE_MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2", "gpt-image-1.5"];
const IMAGE_QUALITY = "medium";
const CLAUDE_MODEL = "claude-opus-5-5";
const DAILY_IMAGES = 9; // 3 séances photo (3 expressions) par enfant et par jour
const MAX_IMAGE_BASE64 = 7_000_000; // ~5 Mo
const BUCKET = "portraits";
const BUDGET_MS = 140_000; // la fonction est coupée à 150 s

const EXPRS = ["happy", "joy", "encourage"] as const;
type Expr = (typeof EXPRS)[number];

// Le rendu visé : les enfants des films Pixar (Coco, Ratatouille)
const LOOK =
  "Pixar-style 3D animated feature film character, like the children in Coco or Ratatouille: stylized, appealing proportions with a slightly larger head, " +
  "big expressive eyes with glossy irises and bright catchlights, soft rounded cheeks, a small cute nose, skin with soft subsurface scattering, " +
  "hair sculpted in soft clumps with fine strands and gentle highlights, warm soft key light with a subtle rim light, cinematic high-detail render.";
const FRAMING =
  "Head-and-neck portrait facing the camera, centered, with the whole head and hair visible and a little empty space above the hair. " +
  "The neck goes straight down to the bottom edge of the image; nothing below the neck is visible. No hat, no accessories, no text.";
const SMILE = "Expression: a warm, gentle closed-mouth smile.";
const SAME_CHARACTER =
  "This is a Pixar-style 3D animated film character. Keep exactly the same character: same face, hair, colors, art style and lighting, " +
  "with the same framing, size and position in the image, and the neck still going straight down to the bottom edge. ";

const PROMPTS: Record<Expr, string> = {
  happy:
    `Transform the child in this photo into a ${LOOK} Keep a strong, recognizable likeness of this child: same hairstyle and hair color, face shape, ` +
    `eye shape and color, skin tone, eyebrows, nose, ears, and freckles or glasses if any. ${FRAMING} ${SMILE}`,
  joy:
    SAME_CHARACTER +
    "Change only the facial expression: overjoyed, a big open-mouth laugh showing the teeth, cheeks raised, eyes happily squinting, eyebrows up.",
  encourage:
    SAME_CHARACTER +
    "Change only the facial expression: determined and encouraging, a small confident half-smile with the mouth closed, " +
    "eyebrows slightly lowered in concentration, kind and motivated eyes.",
};

// Si OpenAI refuse la photo, Claude décrit l'enfant et OpenAI le dessine d'après ce texte seul
const DESCRIBE_PROMPT = `Describe the child in this photo for a character artist who will recreate them as a 3D animated film character.
Write one paragraph in English, 60 to 90 words: hairstyle, hair length and color, face shape, skin tone, eye shape and color, eyebrows, nose, ears,
smile and teeth, freckles, glasses, and any other distinctive visible feature. Describe only what is visible; do not name, identify or speculate about the person.`;
const fromDescription = (description: string) => `A young child as a ${LOOK} ${description} ${FRAMING} ${SMILE}`;

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

  // Journal de chaque création (durée, modèle, erreur ; jamais l'image) pour régler le service
  const started = Date.now();
  const deadline = started + BUDGET_MS;
  const log = (ok: boolean, extra: { model?: string; via?: string; detail?: string }) =>
    admin.from("portrait_runs")
      .insert({ family_id: child.family_id, child_id: child.id, expr, ok, ms: Date.now() - started, ...extra })
      .then(({ error }) => error && console.error("make-portrait: journal", error.message));
  const fail = async (message: string, status: number, detail: string) => {
    console.error("make-portrait:", detail);
    await log(false, { detail: detail.slice(0, 500) });
    return reply({ error: message, detail }, status);
  };

  // 3. Image de départ : la photo, ou le visage « happy » déjà créé pour garder le même personnage
  let input: Blob;
  if (expr === "happy") {
    input = new Blob([decode(image as string)], { type: mediaType as string });
  } else {
    const { data, error } = await admin.storage.from(BUCKET).download(`${base}/happy.webp`);
    if (error || !data) return fail("Le premier visage est introuvable. Recommence la photo magique.", 404, `visage happy introuvable: ${error?.message ?? ""}`);
    input = data;
  }

  // 4. Limite quotidienne (pour maîtriser le coût), rendue si la création échoue
  const { data: allowed, error: quotaError } = await admin.rpc("take_portrait_quota", { p_child: child.id, p_family: child.family_id, p_limit: DAILY_IMAGES });
  if (quotaError) return fail("La magie n'a pas marché cette fois-ci. Réessaie dans un instant.", 500, `quota: ${quotaError.message}`);
  if (!allowed) return reply({ error: "3 séances photo par jour au maximum. On réessaie demain !" }, 429);
  const refund = () => admin.rpc("refund_portrait_quota", { p_child: child.id });

  // 5. Création du visage par OpenAI
  let face: Face;
  try {
    face = await createFace(apiKey, expr as Expr, input, deadline, expr === "happy" ? { image: image as string, mediaType: mediaType as string } : null);
  } catch (e) {
    await refund();
    const { message, status, detail } = explain(e);
    return fail(message, status, `OpenAI ${detail}`);
  }

  const { error: upError } = await admin.storage.from(BUCKET).upload(`${base}/${expr}.webp`, decode(face.b64), { contentType: "image/webp", upsert: true });
  if (upError) {
    await refund();
    return fail("Le personnage n'a pas pu être enregistré. Réessaie dans un instant.", 500, `enregistrement: ${upError.message}`);
  }

  // 6. Repères du visage par Claude (en cas d'échec ou de manque de temps, l'app utilise un cadrage moyen)
  const marks = await findMarks(face.b64, deadline);
  const b64 = face.b64;
  await log(true, { model: face.model, via: face.via });

  // 7. Ménage : on ne garde que la nouvelle version et celle que l'enfant porte encore
  if (expr === "happy") {
    const current = (child.look as { portrait?: { base?: string } } | null)?.portrait?.base?.split("/")[2];
    await cleanup(admin, folder, [v, current ?? ""]).catch((e) => console.error("make-portrait: ménage", e?.message));
  }

  return reply({ version: v, base, expr, marks, image: b64 });
});

type Face = { b64: string; model: string; via: "photo" | "description" };
type OpenAIError = Error & { status?: number; code?: string; type?: string };

async function createFace(apiKey: string, expr: Expr, input: Blob, deadline: number, photo: { image: string; mediaType: string } | null): Promise<Face> {
  try {
    return { ...(await withModels((model) => openai(apiKey, model, PROMPTS[expr], input, deadline))), via: "photo" };
  } catch (e) {
    // Photo refusée par la modération d'OpenAI : Claude décrit l'enfant, OpenAI le dessine d'après ce texte
    if (!photo || !isModeration(e as OpenAIError)) throw e;
    const description = await describe(photo.image, photo.mediaType, deadline);
    if (!description) throw e;
    return { ...(await withModels((model) => openai(apiKey, model, fromDescription(description), null, deadline))), via: "description" };
  }
}

// Modèle absent ou non autorisé pour ce compte : on passe au suivant
async function withModels(run: (model: string) => Promise<string>) {
  let last: unknown;
  for (const model of IMAGE_MODELS) {
    try {
      return { b64: await run(model), model };
    } catch (e) {
      last = e;
      const err = e as OpenAIError;
      const text = err.message ?? "";
      const modelProblem = err.code === "model_not_found" || err.status === 404 ||
        ((err.status === 400 || err.status === 403) && /model/i.test(text) && !/verif/i.test(text) && !isModeration(err));
      if (!modelProblem) throw e;
    }
  }
  throw last;
}

const isModeration = (err: OpenAIError) =>
  err.code === "moderation_blocked" || /moderation|safety system|content policy/i.test(err.message ?? "");

// input : image de départ (édition) ; null : création d'après le texte seul
async function openai(apiKey: string, model: string, prompt: string, input: Blob | null, deadline: number, transparent = true): Promise<string> {
  const params: Record<string, string> = {
    model,
    prompt,
    size: "1024x1024",
    quality: IMAGE_QUALITY,
    output_format: "webp",
    output_compression: "90",
    ...(transparent ? { background: "transparent" } : {}),
  };
  let body: FormData | string;
  if (input) {
    body = new FormData();
    for (const [k, v] of Object.entries(params)) body.append(k, v);
    body.append("image[]", input, input.type === "image/jpeg" ? "photo.jpg" : input.type === "image/png" ? "photo.png" : "visage.webp");
  } else {
    body = JSON.stringify({ ...params, output_compression: 90, n: 1 });
  }
  const res = await fetch(`https://api.openai.com/v1/images/${input ? "edits" : "generations"}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, ...(input ? {} : { "Content-Type": "application/json" }) },
    body,
    signal: AbortSignal.timeout(Math.max(5_000, deadline - Date.now())),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error ?? {};
    // Fond transparent refusé par le modèle : on recommence avec un fond, que l'app retire elle-même
    if (transparent && res.status === 400 && /background|transparen/i.test(err.message ?? "")) {
      return openai(apiKey, model, prompt, input, deadline, false);
    }
    throw Object.assign(new Error(err.message ?? `Erreur OpenAI ${res.status}`), { status: res.status, code: err.code, type: err.type });
  }
  const out = json?.data?.[0]?.b64_json;
  if (typeof out !== "string") throw Object.assign(new Error("Réponse OpenAI sans image"), { status: 502 });
  return out;
}

async function describe(image: string, mediaType: string, deadline: number): Promise<string | null> {
  try {
    const anthropic = claudeClient();
    const response = await anthropic.beta.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
              { type: "text", text: DESCRIBE_PROMPT },
            ],
          },
        ],
      } as Parameters<typeof anthropic.beta.messages.create>[0],
      { timeout: Math.max(5_000, Math.min(30_000, deadline - Date.now() - 60_000)), maxRetries: 0 },
    );
    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
    return text?.text?.trim().slice(0, 900) || null;
  } catch (e) {
    console.error("make-portrait: description", (e as Error)?.message?.slice(0, 200));
    return null;
  }
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

async function findMarks(b64: string, deadline: number): Promise<Marks> {
  const left = deadline - Date.now();
  if (left < 8_000) return DEFAULT_MARKS;
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
    } as Parameters<typeof anthropic.beta.messages.create>[0], { timeout: Math.min(25_000, left - 3_000), maxRetries: 0 });
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
