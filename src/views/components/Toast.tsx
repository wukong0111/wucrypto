import type { FC } from "hono/jsx";
import { Icon } from "./Icon";

type ToastProps = {
  message: string;
  id?: string;
};

const dismissScript = `
var t = this.closest("[data-toast]");
if (t) {
  t.classList.add("hiding");
  t.addEventListener("animationend", function handler() {
    t.removeEventListener("animationend", handler);
    if (t.parentNode) t.remove();
  });
}
`;
export const Toast: FC<ToastProps> = ({ message, id = crypto.randomUUID() }) => (
  <div hx-swap-oob="beforeend:#toast-container">
    <div
      id={`toast-${id}`}
      data-toast
      role="status"
      aria-live="polite"
      class="toast pointer-events-auto w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-blue-600 p-0.5 shadow-lg"
    >
      <div class="rounded-md bg-blue-600 px-4 py-3">
        <div class="flex items-start gap-3">
          <Icon name="trash-2" class="w-5 h-5 text-white/90 shrink-0 mt-0.5" />
          <div class="flex-1 text-sm text-white font-medium leading-relaxed">{message}</div>
          <button
            type="button"
            hx-on:click={dismissScript}
            class="text-white/70 hover:text-white hover:bg-white/10 transition-colors rounded p-1 -mr-1 -mt-1"
            aria-label="Close notification"
          >
            <Icon name="x" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
);
