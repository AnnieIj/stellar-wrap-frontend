"use client";

import { RecentLedgers } from "@/app/components/RecentLedgers";

export default function RecentLedgersPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Recent Ledgers Demo</h1>
        <RecentLedgers limit={5} showMutationExample />
      </div>
    </div>
  );
}