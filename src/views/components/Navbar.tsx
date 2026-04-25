import type { FC } from "hono/jsx";

type NavbarProps = {
  username?: string | undefined;
};

export const Navbar: FC<NavbarProps> = ({ username }) => (
  <header class="sticky top-0 z-20 bg-gray-950 border-b border-gray-800">
    <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
        <img src="/favicon.svg" width="28" height="28" alt="" class="rounded-[7px]" />
        <span class="font-bold text-base tracking-tight">Wucrypto</span>
      </a>
      {username && (
        <div class="flex items-center gap-4 text-sm">
          <a href="/settings" class="text-gray-400 hover:text-white transition-colors">
            {username}
          </a>
          <form action="/logout" method="post" class="inline">
            <button type="submit" class="text-gray-500 hover:text-white transition-colors">
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  </header>
);
