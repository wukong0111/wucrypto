import type { FC } from "hono/jsx";

export const Navbar: FC = () => (
  <header class="sticky top-0 z-20 bg-gray-950 border-b border-gray-800">
    <div class="max-w-4xl mx-auto px-4 h-14 flex items-center">
      <a href="/" class="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
        <img src="/favicon.svg" width="28" height="28" alt="" class="rounded-[7px]" />
        <span class="font-bold text-base tracking-tight">Wucrypto</span>
      </a>
    </div>
  </header>
);
