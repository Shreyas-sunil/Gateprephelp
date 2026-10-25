import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="display text-3xl">Nothing here</h1>
      <p className="mt-2 text-sm text-ink-2">The cat checked under the sofa too.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-violet-2 hover:underline">
        Back to Mission Control
      </Link>
    </div>
  );
}
