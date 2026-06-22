import Link from 'next/link'

export default function BylawsPage() {
  return (
    <div className="fixed inset-0 bg-[#091540]">
      <Link
        href="/history"
        aria-label="Close bylaws"
        className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#091540] text-white text-2xl leading-none shadow-lg border border-white/20 hover:bg-[#060e2e] active:scale-90 transition-all"
      >
        &times;
      </Link>
      <iframe
        src="/2026%20RGA%20Bylaws.pdf"
        title="2026 RGA Bylaws"
        className="w-full h-full border-0"
      />
    </div>
  )
}
