import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-24">
      <p className="text-xs text-muted">
        <span className="text-white">$</span> badge --lookup
      </p>
      <h1 className="text-3xl font-bold tracking-tight">404 · badge not found<span className="cursor" /></h1>
      <p className="text-sm text-neutral-400">That id is unknown or has been tampered with. Badges are signed — typos count.</p>
      <Link href="/claim" className="btn-primary">
        Claim a fresh one →
      </Link>
    </div>
  );
}
