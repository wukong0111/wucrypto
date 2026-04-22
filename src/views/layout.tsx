import type { FC, PropsWithChildren } from "hono/jsx";

type LayoutProps = {
  title: string;
};

const Layout: FC<PropsWithChildren<LayoutProps>> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} | Crypto Tracker</title>
      <link rel="stylesheet" href="/app.css" />
      <script src="/htmx.min.js" />
    </head>
    <body class="bg-gray-950 text-gray-100 min-h-screen">
      <main class="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </body>
  </html>
);

export default Layout;
