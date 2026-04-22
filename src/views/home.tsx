import type { FC } from "hono/jsx";
import type { GroupMeta } from "../lib/storage";

type HomeViewProps = {
  groups: GroupMeta[];
};

const HomeView: FC<HomeViewProps> = ({ groups }) => (
  <>
    <h1 class="text-2xl font-bold mb-6">Crypto Tracker</h1>

    <form hx-post="/groups" hx-target="#groups-list" hx-swap="beforeend" class="mb-6 flex gap-2">
      <input
        type="text"
        name="name"
        placeholder="Group name"
        required
        class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium"
      >
        Create
      </button>
    </form>

    <ul id="groups-list" class="space-y-2">
      {groups.map((g) => (
        <GroupItem key={g.id} group={g} />
      ))}
    </ul>

    {groups.length === 0 && <p class="text-gray-500 text-sm">No groups yet. Create one above.</p>}
  </>
);

export default HomeView;

type GroupItemProps = {
  group: GroupMeta;
};

export const GroupItem: FC<GroupItemProps> = ({ group }) => (
  <li
    id={`group-${group.id}`}
    class="flex items-center justify-between bg-gray-800 rounded px-4 py-3"
  >
    <a href={`/groups/${group.id}`} class="text-blue-400 hover:underline font-medium">
      {group.name}
    </a>
    <button
      type="button"
      hx-delete={`/groups/${group.id}`}
      hx-target={`#group-${group.id}`}
      hx-swap="outerHTML"
      hx-confirm="Delete this group and all its coins?"
      class="text-gray-500 hover:text-red-400 text-sm"
    >
      Delete
    </button>
  </li>
);

export const GroupItemFragment: FC<GroupItemProps> = ({ group }) => (
  <li
    id={`group-${group.id}`}
    class="flex items-center justify-between bg-gray-800 rounded px-4 py-3"
  >
    <a href={`/groups/${group.id}`} class="text-blue-400 hover:underline font-medium">
      {group.name}
    </a>
    <button
      type="button"
      hx-delete={`/groups/${group.id}`}
      hx-target={`#group-${group.id}`}
      hx-swap="outerHTML"
      hx-confirm="Delete this group and all its coins?"
      class="text-gray-500 hover:text-red-400 text-sm"
    >
      Delete
    </button>
  </li>
);
