// Code PIN parent : simple barrière pour que les enfants ne se notent pas eux-mêmes.
// On ne stocke qu'un hash (SHA-256 salé avec l'identifiant de la famille).
export async function hashPin(pin, familyId) {
  const data = new TextEncoder().encode(`pandiflow:${familyId}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPin(pin, familyId, expectedHash) {
  if (!expectedHash) return false;
  return (await hashPin(pin, familyId)) === expectedHash;
}
