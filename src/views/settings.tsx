import type { FC } from "hono/jsx";
import { FormError } from "./components/FormError";
import Layout from "./layout";

type SettingsViewProps = {
  username: string;
  coingeckoApiKey?: string | null;
  missingKeyError?: boolean;
  invalidKeyError?: boolean;
};

const SettingsView: FC<SettingsViewProps> = ({
  username,
  coingeckoApiKey,
  missingKeyError,
  invalidKeyError,
}) => (
  <Layout title="Settings" username={username}>
    <h1 class="text-2xl font-bold mb-6">Settings</h1>

    {missingKeyError && (
      <div class="bg-red-900/30 border border-red-800 rounded-xl p-4 mb-6">
        <p class="text-red-400 text-sm">
          <strong>API Key required.</strong> You need to configure a CoinGecko API key to view
          prices and search coins.
        </p>
      </div>
    )}

    <div id="username-section" class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
        Change Username
      </h2>
      <p class="text-sm text-gray-400 mb-3">
        Current: <span class="text-white">{username}</span>
      </p>
      <form
        hx-post="/settings/username"
        hx-target="#username-section"
        hx-swap="outerHTML"
        data-err="username-error"
        class="flex gap-2 items-end"
      >
        <div class="flex-1">
          <label
            for="new-username"
            class="block text-xs text-gray-500 mb-1 uppercase tracking-wide"
          >
            New Username
          </label>
          <input
            id="new-username"
            type="text"
            name="username"
            required
            autocomplete="username"
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Update
        </button>
      </form>
      <FormError id="username-error" />
    </div>

    <div id="password-section" class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
        Change Password
      </h2>
      <form
        hx-post="/settings/password"
        hx-target="#password-section"
        hx-swap="outerHTML"
        data-err="password-error"
        id="password-section"
      >
        <div class="space-y-3 mb-4">
          <div>
            <label
              for="current-password"
              class="block text-xs text-gray-500 mb-1 uppercase tracking-wide"
            >
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              name="currentPassword"
              required
              autocomplete="current-password"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label
              for="new-password"
              class="block text-xs text-gray-500 mb-1 uppercase tracking-wide"
            >
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              name="newPassword"
              required
              autocomplete="new-password"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <button
          type="submit"
          class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Update Password
        </button>
      </form>
      <FormError id="password-error" />
    </div>

    <div id="coingecko-section" class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
        CoinGecko API Key
      </h2>
      <p class="text-sm text-gray-400 mb-3">
        Current:{" "}
        <span class="text-white">{coingeckoApiKey ? "••••••••••••" : "Not configured"}</span>
      </p>
      <form
        hx-post="/settings/coingecko-key"
        hx-target="#coingecko-section"
        hx-swap="outerHTML"
        data-err="coingecko-key-error"
        class="flex gap-2 items-end"
      >
        <div class="flex-1">
          <label
            for="coingecko-key"
            class="block text-xs text-gray-500 mb-1 uppercase tracking-wide"
          >
            API Key
          </label>
          <input
            id="coingecko-key"
            type="text"
            name="apiKey"
            autocomplete="off"
            placeholder={
              coingeckoApiKey ? "Enter new key to update" : "Enter your CoinGecko API key"
            }
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {coingeckoApiKey ? "Update" : "Save"}
        </button>
      </form>
      {invalidKeyError && (
        <div id="coingecko-key-error" class="text-red-400 text-sm mt-2 min-h-[1.25rem]">
          Invalid API key. Please verify your key and try again.
        </div>
      )}
      {!invalidKeyError && <FormError id="coingecko-key-error" />}
      <p class="text-xs text-gray-500 mt-3">
        Get your free API key from{" "}
        <a
          href="https://www.coingecko.com/en/developers/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-400 hover:text-blue-300 underline"
        >
          CoinGecko Developer Dashboard
        </a>
        .
      </p>
    </div>
  </Layout>
);

export default SettingsView;
