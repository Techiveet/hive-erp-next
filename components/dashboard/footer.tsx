// components/dashboard/footer.tsx

import { Command } from "lucide-react";
import Link from "next/link";

export function DashboardFooter() {
  return (
    <footer className="mt-4">
      <div className="glass-panel rounded-[2rem] px-5 py-4 text-xs text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2">
            <Command className="h-4 w-4 text-foreground" />
            <span className="font-semibold text-foreground">Hive OS</span>
            <span>© 2025</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/status" className="hover:text-foreground">Status</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
