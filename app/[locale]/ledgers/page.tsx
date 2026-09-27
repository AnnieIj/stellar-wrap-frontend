import { RecentLedgers } from "@/app/components/RecentLedgers";

export default function LedgersPage() {
  return (
    <div className="min-h-screen px-4 pt-24 pb-12 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <RecentLedgers />
      </div>
    </div>
  );
}
