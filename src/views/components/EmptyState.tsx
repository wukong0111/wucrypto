import type { FC } from "hono/jsx";
import { Icon } from "./Icon";

type EmptyStateProps = {
  icon: string;
  title: string;
  hint?: string;
};

export const EmptyState: FC<EmptyStateProps> = ({ icon, title, hint }) => (
  <div class="flex flex-col items-center py-16 text-center">
    <div class="text-gray-700 mb-4">
      <Icon name={icon} class="w-10 h-10" />
    </div>
    <p class="text-gray-400 font-medium">{title}</p>
    {hint && <p class="text-gray-600 text-sm mt-1">{hint}</p>}
  </div>
);
