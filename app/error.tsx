"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Cat } from "@/components/cat/Cat";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Cat mood="encouraging" size={96} />
      <h1 className="display text-2xl">This page hit a snag</h1>
      <p className="max-w-md text-sm text-ink-2">Your data is stored safely in this browser. Try again, or export a backup from Settings if this keeps happening.</p>
      <p className="max-w-md font-mono text-xs text-ink-3">{error.message}</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/settings">
          <Button>Open Settings</Button>
        </Link>
      </div>
    </div>
  );
}
