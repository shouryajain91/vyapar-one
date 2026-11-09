/** Shown immediately while the next page loads, so clicks feel instant. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="mb-3 h-7 w-56 rounded bg-slate-200" />
      <div className="mb-8 h-4 w-80 max-w-full rounded bg-slate-100" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}
      </div>
      <div className="h-64 rounded-xl bg-slate-100" />
    </div>
  );
}
