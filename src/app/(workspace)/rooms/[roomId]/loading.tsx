export default function RoomLoading() {
  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border border-line bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-paper-deep" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-7 w-56 rounded-md bg-paper-deep" />
                <div className="flex gap-2">
                  <div className="h-6 w-20 rounded-md bg-paper-deep" />
                  <div className="h-6 w-28 rounded-md bg-paper-deep" />
                </div>
              </div>
            </div>
          </div>
          <section className="overflow-hidden rounded-lg border border-line bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="h-6 w-44 rounded-md bg-paper-deep" />
              <div className="h-6 w-20 rounded-md bg-paper-deep" />
            </div>
            <div className="flex min-h-[28rem] max-h-[min(64dvh,44rem)] flex-col gap-4 bg-paper/45 px-4 py-4">
              <div className="h-14 w-2/5 rounded-lg border border-line bg-card" />
              <div className="ml-auto h-14 w-1/3 rounded-lg bg-sage/80" />
              <div className="h-20 w-1/2 rounded-lg border border-line bg-card" />
            </div>
            <div className="border-t border-line bg-card p-3">
              <div className="mb-2 h-7 w-36 rounded-md bg-paper-deep" />
              <div className="flex items-end gap-2">
                <div className="h-11 flex-1 rounded-lg border border-line bg-white/70" />
                <div className="h-11 w-20 rounded-lg bg-sage/80" />
              </div>
            </div>
          </section>
        </section>
        <aside className="hidden min-w-0 space-y-4 xl:block">
          <div className="h-36 rounded-lg border border-line bg-card shadow-sm" />
          <div className="h-44 rounded-lg border border-line bg-card shadow-sm" />
          <div className="h-52 rounded-lg border border-line bg-card shadow-sm" />
        </aside>
      </div>
    </main>
  );
}
