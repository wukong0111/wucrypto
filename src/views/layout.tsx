import type { FC, PropsWithChildren } from "hono/jsx";

type LayoutProps = {
  title: string;
};

const confirmScript = `
document.addEventListener("click", function(e) {
  var btn = e.target.closest("[data-confirm-delete]");
  if (!btn) {
    var pending = document.querySelector("[data-confirm-delete].confirm-pending");
    if (pending) resetBtn(pending);
    return;
  }
  if (btn.classList.contains("confirm-pending")) return;
  e.stopPropagation();
  e.preventDefault();
  btn.dataset.originalText = btn.textContent;
  btn.textContent = "Confirmar?";
  btn.classList.add("confirm-pending");
  var timer = setTimeout(function() { resetBtn(btn); }, 3000);
  btn.dataset.confirmTimer = timer;
}, true);

function resetBtn(btn) {
  if (!btn.classList.contains("confirm-pending")) return;
  btn.classList.remove("confirm-pending");
  btn.textContent = btn.dataset.originalText || "Delete";
  clearTimeout(Number(btn.dataset.confirmTimer));
  delete btn.dataset.confirmTimer;
  delete btn.dataset.originalText;
}
`;

const Layout: FC<PropsWithChildren<LayoutProps>> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} | Crypto Tracker</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="stylesheet" href="/app.css" />
      <script src="/htmx.min.js" />
    </head>
    <body class="bg-gray-950 text-gray-100 min-h-screen">
      <main class="max-w-4xl mx-auto px-4 py-8">{children}</main>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static confirm script, no user input */}
      <script dangerouslySetInnerHTML={{ __html: confirmScript }} />
    </body>
  </html>
);

export default Layout;
