import type { FC } from "hono/jsx";
import type { GroupMeta } from "../lib/storage";
import { EmptyState } from "./components/EmptyState";
import { FormError } from "./components/FormError";
import { Icon } from "./components/Icon";

type HomeViewProps = {
  groups: GroupMeta[];
};

const HomeView: FC<HomeViewProps> = ({ groups }) => (
  <>
    <h1 class="text-2xl font-bold mb-6">Portfolio Groups</h1>

    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8">
      <form
        hx-post="/groups"
        hx-target="#groups-list"
        hx-swap="beforeend"
        data-err="new-group-error"
        class="flex gap-2"
      >
        <input
          type="text"
          name="name"
          placeholder="New group name..."
          required
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          class="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Icon name="plus" class="w-4 h-4" />
          New Group
        </button>
      </form>
      <FormError id="new-group-error" />
    </div>

    <ul id="groups-list" class="space-y-2">
      {groups.map((g) => (
        <GroupItem key={g.id} group={g} />
      ))}
    </ul>

    {groups.length === 0 && (
      <EmptyState
        icon="inbox"
        title="No groups yet"
        hint="Create a group above to start tracking your portfolio."
      />
    )}
  </>
);

export default HomeView;

type GroupItemProps = {
  group: GroupMeta;
};

export const GroupItem: FC<GroupItemProps> = ({ group }) => (
  <li
    id={`group-${group.id}`}
    class="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 transition-colors"
  >
    <a
      href={`/groups/${group.id}`}
      class="font-medium text-white hover:text-blue-400 transition-colors"
    >
      {group.name}
    </a>
    <button
      type="button"
      hx-delete={`/groups/${group.id}`}
      hx-target={`#group-${group.id}`}
      hx-swap="outerHTML"
      data-confirm-delete
      title="Delete group"
      class="text-gray-600 hover:text-red-400 transition-colors p-1 rounded"
    >
      <Icon name="trash-2" class="w-4 h-4" />
    </button>
  </li>
);
