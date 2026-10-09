/**
 * Shown the moment a signed-in page is asked for, while its data loads: a heading and a few cards in
 * the page column. It is also what Next prefetches for every in-app link, so a tap paints this
 * straight away instead of holding the old page until the server answers.
 */
export default function AppLoading() {
  return (
    <div role="status" aria-busy="true" className="flex animate-pulse flex-col gap-3.5 motion-reduce:animate-none md:gap-5">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-2.5 pt-1">
        <div className="h-4 w-28 rounded-full bg-sunken" />
        <div className="h-9 w-64 max-w-full rounded-[12px] bg-sunken" />
      </div>
      <div className="h-[168px] rounded-[30px] bg-sunken" />
      <div className="grid grid-cols-3 gap-2.5">
        <div className="h-[88px] rounded-[24px] bg-sunken" />
        <div className="h-[88px] rounded-[24px] bg-sunken" />
        <div className="h-[88px] rounded-[24px] bg-sunken" />
      </div>
      <div className="h-[92px] rounded-[24px] bg-sunken" />
      <div className="h-[92px] rounded-[24px] bg-sunken" />
      <div className="h-[92px] rounded-[24px] bg-sunken" />
    </div>
  );
}
