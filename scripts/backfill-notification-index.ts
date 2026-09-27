import Redis from "ioredis";

const VALID_PERIODS = ["weekly", "monthly", "yearly"] as const;
const redis = new Redis();

(async () => {
  for await (const key of redis.scanIterator({ match: "notif:sub:*" })) {
    const raw = await redis.get(key);
    if (!raw) continue;
    const record = JSON.parse(raw) as {
      walletAddress: string;
      push?: { periods?: Record<string, boolean> };
    };
    const addr = record.walletAddress ?? key.slice("notif:sub:".length);
    const periods = record.push?.periods;
    if (!periods) continue;
    for (const period of VALID_PERIODS) {
      if (periods[period]) await redis.sadd(`notif:period:${period}`, addr);
    }
  }
  await redis.quit();
})();
