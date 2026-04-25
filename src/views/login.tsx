import type { FC } from "hono/jsx";
import Layout from "./layout";

type LoginViewProps = { error?: string };

const LoginView: FC<LoginViewProps> = ({ error }) => (
  <Layout title="Login">
    <div class="max-w-sm mx-auto mt-20">
      <h1 class="text-2xl font-bold mb-6 text-center">Log in to Wucrypto</h1>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <form method="post" action="/login" class="space-y-4">
          <div>
            <label
              for="login-username"
              class="block text-xs text-gray-500 mb-1 uppercase tracking-wide"
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              name="username"
              required
              autocomplete="username"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label
              for="login-password"
              class="block text-xs text-gray-500 mb-1 uppercase tracking-wide"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              name="password"
              required
              autocomplete="current-password"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          {error && <p class="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Log in
          </button>
        </form>
        <p class="text-center text-gray-500 text-sm mt-4">
          No account?{" "}
          <a href="/register" class="text-blue-400 hover:text-blue-300">
            Register
          </a>
        </p>
      </div>
    </div>
  </Layout>
);

export default LoginView;
