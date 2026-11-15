import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
const KEY_LENGTH = 64;
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, length, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: MAX_MEMORY });
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, "base64");
  const actual = await scrypt(password, Buffer.from(saltValue, "base64"), expected.length, {
    N: Number(cost), r: Number(blockSize), p: Number(parallelization), maxmem: MAX_MEMORY,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
