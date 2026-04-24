import type { FC } from "hono/jsx";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export const Breadcrumbs: FC<BreadcrumbsProps> = ({ items }) => (
  <nav class="flex items-center text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
    {items.map((item, i) => (
      <div key={item.label} class="flex items-center">
        {i > 0 && <span class="mx-2 text-gray-700">›</span>}
        {item.href ? (
          <a href={item.href} class="hover:text-gray-300 transition-colors">
            {item.label}
          </a>
        ) : (
          <span class="text-gray-300">{item.label}</span>
        )}
      </div>
    ))}
  </nav>
);
