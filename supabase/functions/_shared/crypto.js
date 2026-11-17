const encode = (bytes) => btoa(String.fromCharCode(...bytes));
const decode = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
async function keyFrom(secret) {
  const b = decode(secret);
  if (b.length !== 32)
    throw new Error("Server-Verschlüsselung nicht eingerichtet.");
  return crypto.subtle.importKey("raw", b, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await keyFrom(secret),
    new TextEncoder().encode(value),
  );
  return { ciphertext: encode(new Uint8Array(data)), iv: encode(iv) };
}
export async function unseal(record, secret) {
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(record.iv) },
      await keyFrom(secret),
      decode(record.ciphertext),
    ),
  );
}
