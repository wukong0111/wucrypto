import type { FC, PropsWithChildren } from "hono/jsx";
import { Navbar } from "./components/Navbar";

type LayoutProps = {
  title: string;
  username?: string;
};

const confirmScript = `
document.addEventListener("click", function(e) {
  var btn = e.target.closest("[data-confirm-delete]");
  if (!btn) {
    var pending = document.querySelector("[data-confirm-delete].confirm-pending");
    if (pending) resetConfirm(pending);
    return;
  }
  if (btn.classList.contains("confirm-pending")) return;
  e.stopPropagation();
  e.preventDefault();
  btn.classList.add("confirm-pending");
  btn.setAttribute("title", "Click again to confirm");
  var timer = setTimeout(function() { resetConfirm(btn); }, 3000);
  btn.dataset.confirmTimer = timer;
}, true);

function resetConfirm(btn) {
  if (!btn.classList.contains("confirm-pending")) return;
  btn.classList.remove("confirm-pending");
  btn.removeAttribute("title");
  clearTimeout(Number(btn.dataset.confirmTimer));
  delete btn.dataset.confirmTimer;
}
`;

const htmxConfig = `
htmx.config.responseHandling = [
  {code:"204", swap:false},
  {code:"[23]..", swap:true},
  {code:"[45]..", swap:true, error:true},
  {code:"...", swap:false}
];
document.addEventListener("htmx:beforeRequest", function(e) {
  var elt = e.detail && e.detail.elt;
  if (!elt) return;
  var form = elt.closest ? elt.closest("[data-err]") : null;
  if (!form && elt.getAttribute) form = elt.getAttribute("data-err") ? elt : null;
  if (!form) return;
  var errId = form.getAttribute("data-err");
  if (errId) {
    var errEl = document.getElementById(errId);
    if (errEl) errEl.innerHTML = "";
  }
});
`;

const Layout: FC<PropsWithChildren<LayoutProps>> = ({ title, username, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} | Wucrypto</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="stylesheet" href="/app.css" />
      <script src="/htmx.min.js" />
    </head>
    <body class="bg-gray-950 text-gray-100 min-h-screen">
      <Navbar username={username} />
      <main class="max-w-4xl mx-auto px-4 py-8">{children}</main>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static htmx config, no user input */}
      <script dangerouslySetInnerHTML={{ __html: htmxConfig }} />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static confirm script, no user input */}
      <script dangerouslySetInnerHTML={{ __html: confirmScript }} />
    </body>
  </html>
);

export default Layout;
