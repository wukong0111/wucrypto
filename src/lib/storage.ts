import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

export type Movement = {
  id: string;
  type: "buy" | "sell";
  date: string;
  amount: number;
  pricePerCoin: number;
  note: string;
};

export type GroupMeta = {
  id: string;
  name: string;
  createdAt: string;
};

export type GroupIndex = {
  groups: GroupMeta[];
};

export type CoinFile = {
  coinId: string;
  symbol: string;
  name: string;
  movements: Movement[];
};

const dataDir = () => Bun.env["DATA_DIR"] || "./data";
const locks = new Map<string, Promise<void>>();

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;
    return (await file.json()) as T;
  } catch {
    return null;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(join(filePath, ".."));
  const tmp = `${filePath}.tmp`;
  await Bun.write(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmp, filePath);
}

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let resolve: () => void = () => {};
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  locks.set(key, next);
  await prev;
  try {
    return await fn();
  } finally {
    resolve();
  }
}

const groupsIndexPath = () => join(dataDir(), "groups.json");
const groupDir = (id: string) => join(dataDir(), "groups", id);
const groupMetaPath = (id: string) => join(groupDir(id), "group.json");
const coinsDir = (groupId: string) => join(groupDir(groupId), "coins");
const coinPath = (groupId: string, coinId: string) => join(coinsDir(groupId), `${coinId}.json`);

export async function listGroups(): Promise<GroupIndex> {
  return (await readJson<GroupIndex>(groupsIndexPath())) ?? { groups: [] };
}

export async function createGroup(name: string): Promise<GroupMeta> {
  return withLock(groupsIndexPath(), async () => {
    const index = await listGroups();
    const base = slugify(name);
    let id = base || "group";
    let suffix = 1;
    while (index.groups.some((g) => g.id === id)) {
      id = `${base}-${suffix}`;
      suffix++;
    }
    const meta: GroupMeta = { id, name, createdAt: new Date().toISOString() };
    index.groups.push(meta);
    await ensureDir(groupDir(id));
    await writeJson(groupMetaPath(id), meta);
    await writeJson(groupsIndexPath(), index);
    return meta;
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  return withLock(groupsIndexPath(), async () => {
    const index = await listGroups();
    index.groups = index.groups.filter((g) => g.id !== groupId);
    await writeJson(groupsIndexPath(), index);
    try {
      await rm(groupDir(groupId), { recursive: true, force: true });
    } catch {
      // directory may not exist
    }
  });
}

export async function getGroup(groupId: string): Promise<GroupMeta | null> {
  return readJson<GroupMeta>(groupMetaPath(groupId));
}

export async function listCoins(groupId: string): Promise<CoinFile[]> {
  const dir = coinsDir(groupId);
  try {
    const files = await readdir(dir);
    const coins: CoinFile[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const coin = await readJson<CoinFile>(join(dir, file));
      if (coin) coins.push(coin);
    }
    return coins;
  } catch {
    return [];
  }
}

export async function getCoin(groupId: string, coinId: string): Promise<CoinFile | null> {
  return readJson<CoinFile>(coinPath(groupId, coinId));
}

export async function upsertCoin(groupId: string, coin: CoinFile): Promise<void> {
  return withLock(coinPath(groupId, coin.coinId), async () => {
    await writeJson(coinPath(groupId, coin.coinId), coin);
  });
}

export async function deleteCoin(groupId: string, coinId: string): Promise<void> {
  return withLock(coinPath(groupId, coinId), async () => {
    try {
      await rm(coinPath(groupId, coinId));
    } catch {
      // file may not exist
    }
  });
}

export async function addMovement(
  groupId: string,
  coinId: string,
  movement: Movement,
): Promise<CoinFile> {
  return withLock(coinPath(groupId, coinId), async () => {
    const coin =
      (await readJson<CoinFile>(coinPath(groupId, coinId))) ??
      ({
        coinId,
        symbol: "",
        name: "",
        movements: [],
      } as CoinFile);
    coin.movements.push(movement);
    await writeJson(coinPath(groupId, coinId), coin);
    return coin;
  });
}

export async function deleteMovement(
  groupId: string,
  coinId: string,
  movementId: string,
): Promise<CoinFile | null> {
  return withLock(coinPath(groupId, coinId), async () => {
    const coin = await readJson<CoinFile>(coinPath(groupId, coinId));
    if (!coin) return null;
    coin.movements = coin.movements.filter((m) => m.id !== movementId);
    await writeJson(coinPath(groupId, coinId), coin);
    return coin;
  });
}
