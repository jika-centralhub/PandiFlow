// Edge Function Supabase « make-portrait »
// Crée le personnage d'un enfant façon film d'animation 3D (OpenAI GPT Image) : la tête et le haut
// du corps, en t-shirt blanc uni, dans une pose et une expression. L'image est rangée dans le bucket
// privé « portraits », puis Claude repère les yeux, le nez, le menton et les articulations des bras :
// l'app colore le t-shirt, y pose les costumes et accessoires, et anime les avant-bras autour du coude.
// La photo n'est ni stockée ni journalisée : seules les images générées sont gardées.
// Si OpenAI refuse la photo, Claude la décrit et OpenAI dessine d'après ce texte seul.
// Chaque demande est notée dans public.portrait_runs (durée, modèle, erreur ; jamais d'image).
//
// Requête : { childId, expr: "happy" | "encourage" | "joy" | "dance", image?, mediaType?, version?, fromFace? }
//   happy : mains sur les hanches et sourire, crée une nouvelle version, à partir de la photo
//           (image en base64 + mediaType) ou, avec fromFace, du visage 3D seul d'une version plus ancienne
//   encourage (repos), joy (bras levés, « bravo »), dance : à partir du « happy » de cette version,
//           pour garder le même personnage
// Réponse : { version, base, expr, marks, image } (image = le personnage en webp, base64)
//
// Secrets : OPENAI_API_KEY (tools/set-openai-key.ps1) et ANTHROPIC_API_KEY (déjà utilisée par analyze-photo)

import { adminClient, claudeClient, parentOfChild, replier } from "../_shared/common.ts";

// Du plus récent au plus ancien : si le compte n'a pas accès à un modèle, on essaie le suivant
const IMAGE_MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2", "gpt-image-1.5"];
// Une image prend ~20 s en « medium » : « high » tient encore largement dans les 150 s
const IMAGE_QUALITY = "high";
const CLAUDE_MODEL = "claude-opus-5-5";
const DAILY_IMAGES = 12; // 3 séances photo (4 poses) par enfant et par jour
const MAX_IMAGE_BASE64 = 7_000_000; // ~5 Mo
const BUCKET = "portraits";
const BUDGET_MS = 140_000; // la fonction est coupée à 150 s
// Format portrait : la tête et le haut du corps, bras levés compris
const SIZE = "1024x1536";

const EXPRS = ["happy", "encourage", "joy", "dance"] as const;
type Expr = (typeof EXPRS)[number];

// Le rendu visé : les enfants des films Pixar (Coco, Ratatouille)
const LOOK =
  "Pixar-style 3D animated feature film character, like the children in Coco or Ratatouille: stylized, appealing proportions with a slightly larger head, " +
  "big expressive eyes with glossy irises and bright catchlights, soft rounded cheeks, a small cute nose, skin with soft subsurface scattering, " +
  "hair sculpted in soft clumps with fine strands and gentle highlights, warm soft key light with a subtle rim light, cinematic high-detail render.";
// Le modèle ignore la demande de fond transparent : on demande un fond vert uni, que l'app retire elle-même.
// Le t-shirt blanc uni sert de support : l'app le colore et y pose les costumes en gardant ses plis et sa lumière.
const FRAMING =
  "Upper-body shot facing the camera, centered, from a little above the top of the hair down to the hips: the bottom edge of the image cuts across the hips. " +
  "The child wears a plain pure white long-sleeve crew-neck cotton t-shirt, matte, with no print, no logo, no pattern and no pocket; the sleeves reach the wrists. " +
  "Bare hands with five fingers each, both arms and both hands entirely inside the image, never cropped. " +
  "Perfectly flat, uniform pure chroma-key green background (#00FF00), with no gradient, no shadow, no scenery and no green light on the character or the white t-shirt. " +
  "No hat, no accessories, no text.";
const POSES = {
  rest: "Pose: standing proudly with both hands on the hips, fists resting on the hips and elbows pointing out to the sides.",
  cheer: "Pose: cheering, both arms raised high in a V, elbows slightly bent and pointing outward, open hands with spread fingers at the height of the top of the head, " +
    "the hands and forearms clearly away from the head and hair.",
  dance: "Pose: dancing happily: the arm on the left side of the image raised high with the open hand above the head, the arm on the right side of the image " +
    "bent at shoulder height with the forearm pointing up and the open hand waving, both hands clearly away from the head and hair.",
};
const SMILE = "Expression: a warm, gentle closed-mouth smile.";
const LAUGH = "Expression: overjoyed, a big open-mouth laugh showing the teeth, cheeks raised, eyes happily squinting, eyebrows up.";
const SAME_CHARACTER =
  "This is a Pixar-style 3D animated film character on a flat chroma-key green background. Keep exactly the same character: same face, hair, body, " +
  "white t-shirt, colors, art style, lighting and green background, with the same framing, the same head size and the head at the same position in the image. ";

const PROMPTS: Record<Expr, string> = {
  happy:
    `Transform the child in this photo into a ${LOOK} Keep a strong, recognizable likeness of this child: same hairstyle and hair color, face shape, ` +
    `eye shape and color, skin tone, eyebrows, nose, ears, and freckles or glasses if any. ${FRAMING} ${POSES.rest} ${SMILE}`,
  encourage:
    SAME_CHARACTER + "Keep the same pose, with the hands on the hips. " +
    "Change only the facial expression: determined and encouraging, a small confident half-smile with the mouth closed, " +
    "eyebrows slightly lowered in concentration, kind and motivated eyes.",
  joy: SAME_CHARACTER + `Change the pose and the expression. ${POSES.cheer} ${LAUGH} Both arms and hands stay entirely inside the image.`,
  dance: SAME_CHARACTER + `Change the pose and the expression. ${POSES.dance} ${LAUGH} Both arms and hands stay entirely inside the image.`,
};
// Enfant qui a déjà un visage 3D (ancienne version, tête seule) : on lui crée le corps à partir de ce visage
const FROM_FACE =
  "This is the head of a Pixar-style 3D animated film character on a flat chroma-key green background. Keep exactly the same character: same face, " +
  `hair, skin tone, eyes, colors, art style and lighting, and show the character's upper body. ${FRAMING} ${POSES.rest} ${SMILE}`;

// Si OpenAI refuse la photo, Claude décrit l'enfant et OpenAI le dessine d'après ce texte seul
const DESCRIBE_PROMPT = `Describe the child in this photo for a character artist who will recreate them as a 3D animated film character.
Write one paragraph in English, 60 to 90 words: hairstyle, hair length and color, face shape, skin tone, eye shape and color, eyebrows, nose, ears,
smile and teeth, freckles, glasses, and any other distinctive visible feature. Describe only what is visible; do not name, identify or speculate about the person.`;
const fromDescription = (description: string) => `A young child as a ${LOOK} ${description} ${FRAMING} ${POSES.rest} ${SMILE}`;

// Repères, en fraction de la largeur (x) ou de la hauteur (y) de l'image. « Left » = côté gauche de l'image.
const FACE_KEYS = ["eyeLeftX", "eyeLeftY", "eyeRightX", "eyeRightY", "chinY", "topY", "headLeftX", "headRightX"] as const;
const BODY_KEYS = [
  "noseY", "mouthY", "collarX", "collarY",
  "shoulderLeftX", "shoulderLeftY", "shoulderRightX", "shoulderRightY",
  "elbowLeftX", "elbowLeftY", "elbowRightX", "elbowRightY",
  "wristLeftX", "wristLeftY", "wristRightX", "wristRightY",
  "handLeftX", "handLeftY", "handRightX", "handRightY",
  "waistLeftX", "waistRightX", "waistY",
] as const;
const MARK_KEYS = [...FACE_KEYS, ...BODY_KEYS];
type Marks = Record<string, number>;
// Sans repères fiables, l'app pose seulement la tête de l'image sur le corps dessiné
const DEFAULT_MARKS: Marks = {
  eyeLeftX: 0.4, eyeLeftY: 0.25, eyeRightX: 0.6, eyeRightY: 0.25, chinY: 0.42, topY: 0.04, headLeftX: 0.24, headRightX: 0.76,
};
const MARKS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: MARK_KEYS,
  properties: Object.fromEntries(MARK_KEYS.map((k) => [k, { type: "number" }])),
};
const MARKS_PROMPT = `Cette image montre un personnage de film d'animation 3D (la tête et le haut du corps, en t-shirt blanc), sur fond vert uni.
Donne ces repères en pourcentage de la largeur (x) ou de la hauteur (y) de l'image, de 0 (bord gauche ou haut) à 100 (bord droit ou bas).
« Left » désigne toujours le côté gauche de l'image et « Right » le côté droit, quel que soit le bras du personnage.
Visage :
- eyeLeftX, eyeLeftY : le centre de la pupille de l'œil situé du côté gauche de l'image ;
- eyeRightX, eyeRightY : le centre de la pupille de l'œil situé du côté droit de l'image ;
- noseY : le bas du nez (sous les narines) ; mouthY : le milieu de la bouche ;
- chinY : le bas du menton ;
- topY : le point le plus haut de la tête, cheveux compris ;
- headLeftX, headRightX : les bords gauche et droit de la tête, cheveux compris, sans le cou ni les oreilles.
Corps :
- collarX, collarY : le milieu du bas de l'encolure du t-shirt, sous le cou ;
- shoulderLeftX/Y, shoulderRightX/Y : le centre de chaque épaule, là où le bras rejoint le buste ;
- elbowLeftX/Y, elbowRightX/Y : le centre de chaque coude ;
- wristLeftX/Y, wristRightX/Y : le centre de chaque poignet, au bout de la manche ;
- handLeftX/Y, handRightX/Y : le centre de chaque main ;
- waistY : la hauteur des hanches ; waistLeftX, waistRightX : les bords gauche et droit du buste à cette hauteur, sans les bras ni les mains.`;

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const newVersion = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

Deno.serve(async (req) => {
  const { headers, reply } = replier(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  // 1. Vérification de la requête
  let body: { childId?: unknown; expr?: unknown; image?: unknown; mediaType?: unknown; version?: unknown; fromFace?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Requête invalide." }, 400);
  }
  const { childId, expr, image, mediaType, version } = body;
  const fromFace = expr === "happy" && body.fromFace === true;
  if (typeof childId !== "string" || !EXPRS.includes(expr as Expr)) return reply({ error: "Requête invalide." }, 400);
  const validVersion = typeof version === "string" && /^[a-z0-9]{6,20}$/.test(version);
  if (expr === "happy" && !fromFace) {
    if (typeof image !== "string" || typeof mediaType !== "string") return reply({ error: "Requête invalide." }, 400);
    if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) return reply({ error: "Format de photo non pris en charge." }, 415);
    if (image.length > MAX_IMAGE_BASE64) return reply({ error: "Photo trop lourde." }, 413);
  } else if (!validVersion) {
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

  // 3. Image de départ : la photo, l'ancien visage 3D (fromFace), ou le « happy » de cette version
  //    pour garder le même personnage
  let input: Blob;
  if (expr === "happy" && !fromFace) {
    input = new Blob([decode(image as string)], { type: mediaType as string });
  } else {
    const from = fromFace ? `${folder}/${version}/happy.webp` : `${base}/happy.webp`;
    const { data, error } = await admin.storage.from(BUCKET).download(from);
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
    const prompt = fromFace ? FROM_FACE : PROMPTS[expr as Expr];
    face = await createFace(apiKey, prompt, input, deadline, expr === "happy" && !fromFace ? { image: image as string, mediaType: mediaType as string } : null);
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

  // 7. Ménage : on ne garde que la nouvelle version, celle que l'enfant porte encore et le visage de départ
  if (expr === "happy") {
    const current = (child.look as { portrait?: { base?: string } } | null)?.portrait?.base?.split("/")[2];
    await cleanup(admin, folder, [v, current ?? "", fromFace ? (version as string) : ""]).catch((e) => console.error("make-portrait: ménage", e?.message));
  }

  return reply({ version: v, base, expr, marks, image: b64 });
});

type Face = { b64: string; model: string; via: "photo" | "description" };
type OpenAIError = Error & { status?: number; code?: string; type?: string };

async function createFace(apiKey: string, prompt: string, input: Blob, deadline: number, photo: { image: string; mediaType: string } | null): Promise<Face> {
  try {
    return { ...(await withModels((model) => openai(apiKey, model, prompt, input, deadline))), via: "photo" };
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
async function openai(apiKey: string, model: string, prompt: string, input: Blob | null, deadline: number): Promise<string> {
  const params: Record<string, string> = {
    model,
    prompt,
    size: SIZE,
    quality: IMAGE_QUALITY,
    output_format: "webp",
    output_compression: "92",
  };
  let body: FormData | string;
  if (input) {
    body = new FormData();
    for (const [k, v] of Object.entries(params)) body.append(k, v);
    body.append("image[]", input, input.type === "image/jpeg" ? "photo.jpg" : input.type === "image/png" ? "photo.png" : "visage.webp");
  } else {
    body = JSON.stringify({ ...params, output_compression: 92, n: 1 });
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

// Les repères doivent dessiner un visage plausible, sinon on garde le cadrage moyen ; ceux du corps
// sont gardés seulement s'ils dessinent un buste et deux bras plausibles (sinon l'app pose la tête
// sur le corps dessiné)
function checkMarks(raw: Record<string, unknown>): Marks {
  const values = MARK_KEYS.map((k) => Number(raw[k]));
  const face = values.slice(0, FACE_KEYS.length);
  if (face.some((n) => !Number.isFinite(n))) return DEFAULT_MARKS;
  const finite = values.filter((n) => Number.isFinite(n));
  const scale = finite.every((n) => n <= 1) ? 1 : 100; // pourcentages attendus, fractions acceptées
  const m = Object.fromEntries(MARK_KEYS.map((k, i) => [k, Math.round((values[i] / scale) * 1000) / 1000])) as Marks;
  const eyeY = (m.eyeLeftY + m.eyeRightY) / 2;
  const gap = m.eyeRightX - m.eyeLeftX;
  const faceOk = face.every((n) => n >= 0 && n <= 100) &&
    gap > 0.06 && gap < 0.5 && Math.abs(m.eyeLeftY - m.eyeRightY) < 0.08 &&
    m.topY < eyeY && m.chinY > eyeY && m.chinY - eyeY < 0.5 &&
    m.headLeftX < m.eyeLeftX && m.headRightX > m.eyeRightX;
  if (!faceOk) return DEFAULT_MARKS;
  const faceOnly = Object.fromEntries(FACE_KEYS.map((k) => [k, m[k]])) as Marks;
  const body = BODY_KEYS.map((k) => m[k]);
  if (body.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) return faceOnly;
  const len = (a: string, b: string) => Math.hypot(m[`${a}X`] - m[`${b}X`], (m[`${a}Y`] - m[`${b}Y`]) * 1.5);
  const arm = (s: "Left" | "Right") =>
    len(`shoulder${s}`, `elbow${s}`) > 0.04 && len(`elbow${s}`, `wrist${s}`) > 0.04 && len(`wrist${s}`, `hand${s}`) < 0.12 &&
    m[`shoulder${s}Y`] > m.chinY - 0.02 && m[`shoulder${s}Y`] < m.waistY;
  const bodyOk = m.noseY > eyeY && m.noseY < m.mouthY && m.mouthY < m.chinY &&
    m.collarY > m.chinY - 0.03 && m.collarY < m.waistY &&
    m.shoulderLeftX < m.collarX && m.collarX < m.shoulderRightX &&
    m.waistLeftX < m.collarX && m.collarX < m.waistRightX && m.waistY > m.chinY + 0.1 &&
    arm("Left") && arm("Right");
  return bodyOk ? m : faceOnly;
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
