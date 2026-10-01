import Redis from "ioredis";

const VALID_PERIODS = ["weekly", "monthly", "yearly"] as const;
const redis = new Redis();

(async () => {
  let processed = 0;
  let indexed = 0;
  
  for await (const key of redis.scanIterator({ match: "notif:sub:*" })) {
    const raw = await redis.get(key);
    if (!raw) continue;
    
    processed++;
    const record = JSON.parse(raw) as {
      walletAddress: string;
      push?: { periods?: Record<string, boolean> };
      email?: { periods?: Record<string, boolean> };
    };
    
    const addr = record.walletAddress ?? key.slice("notif:sub:".length);
    
    // Index push notification periods
    const pushPeriods = record.push?.periods;
    if (pushPeriods) {
      for (const period of VALID_PERIODS) {
        if (pushPeriods[period]) {
          await redis.sadd(`notif:period:${period}`, addr);
          indexed++;
        }
      }
    }
    
    // Index email notification periods
    const emailPeriods = record.email?.periods;
    if (emailPeriods) {
      for (const period of VALID_PERIODS) {
        if (emailPeriods[period]) {
          await redis.sadd(`notif:period:${period}`, addr);
          indexed++;
        }
      }
    }
    
    if (processed % 100 === 0) {
      console.log(`Processed ${processed} records, indexed ${indexed} period subscriptions`);
    }
  }
  
  console.log(`✓ Backfill complete: processed ${processed} records, indexed ${indexed} period subscriptions`);
  await redis.quit();
})();
