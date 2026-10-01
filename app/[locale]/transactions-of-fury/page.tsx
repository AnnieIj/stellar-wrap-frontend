import dynamic from "next/dynamic";

const TransactionsOfFury = dynamic(() => import("../../components/TransactionsOfFury"), {
  loading: () => (
    <div
      className="flex min-h-screen items-center justify-center bg-[#030b0a] text-emerald-100/80"
      role="status"
      aria-label="Loading transactions dashboard"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-100/30 border-t-emerald-300 motion-reduce:animate-none"
        aria-hidden="true"
      />
    </div>
  ),
});

export default function TransactionsOfFuryPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <TransactionsOfFury />
    </main>
  );
}
