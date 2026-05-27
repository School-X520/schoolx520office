export default function OfficeLoading() {
  return (
    <div className="min-h-dvh lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden">
      <div className="border-b border-line bg-card/95 px-4 py-3">
        <div className="mx-auto flex max-w-[1780px] items-center justify-between gap-3">
          <div className="h-8 w-56 rounded-md bg-paper-deep" />
          <div className="h-9 w-28 rounded-lg bg-paper-deep" />
        </div>
      </div>
      <main className="mx-auto grid w-full max-w-[1780px] gap-5 px-4 py-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_25rem] lg:overflow-hidden lg:py-3 xl:grid-cols-[minmax(0,1fr)_27rem]">
        <section className="min-w-0 lg:h-full lg:min-h-0">
          <div className="grid h-full min-h-[42rem] grid-cols-2 gap-4 rounded-lg border border-line bg-card p-4 shadow-sm md:grid-cols-3 lg:min-h-0 xl:grid-cols-4">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="min-h-36 rounded-lg border border-line bg-paper/75 p-4">
                <div className="mb-4 size-10 rounded-lg bg-paper-deep" />
                <div className="mb-2 h-5 w-2/3 rounded-md bg-paper-deep" />
                <div className="h-4 w-full rounded-md bg-paper-deep" />
              </div>
            ))}
          </div>
        </section>
        <aside className="min-w-0 space-y-4 lg:h-full lg:min-h-0">
          <div className="h-40 rounded-lg border border-line bg-card shadow-sm" />
          <div className="h-56 rounded-lg border border-line bg-card shadow-sm" />
          <div className="h-48 rounded-lg border border-line bg-card shadow-sm" />
        </aside>
      </main>
    </div>
  );
}
