import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt";

export function isPasswordHash(value: string): boolean {
  const [algorithm, salt, digest, extra] = value.split("$");
  return algorithm === HASH_PREFIX
    && extra === undefined
    && /^[0-9a-f]{32}$/.test(salt ?? "")
    && /^[0-9a-f]{128}$/.test(digest ?? "");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `${HASH_PREFIX}$${salt.toString("hex")}$${digest.toString("hex")}`;
}

export async function createLockedPasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString("base64url"));
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (!isPasswordHash(encodedHash)) return false;

  const [, saltHex, digestHex] = encodedHash.split("$");
  const expected = Buffer.from(digestHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}
