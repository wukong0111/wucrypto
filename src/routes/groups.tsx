import { Hono } from "hono";
import { createGroup, deleteGroup, listGroups } from "../lib/storage";
import HomeView, { GroupItem } from "../views/home";
import Layout from "../views/layout";

const groups = new Hono<{
  Variables: { user: { id: string; username: string } };
}>();

groups.get("/", async (c) => {
  const user = c.get("user");
  const groupList = await listGroups(user.id);
  return c.html(
    <Layout title="Home" username={user.username}>
      <HomeView groups={groupList} />
    </Layout>,
  );
});

groups.post("/groups", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const name = String(body["name"] ?? "").trim();
  if (!name) {
    c.header("HX-Retarget", "#new-group-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span>Name is required</span>, 400);
  }
  const group = await createGroup(user.id, name);
  return c.html(<GroupItem group={group} />);
});

groups.delete("/groups/:groupId", async (c) => {
  const user = c.get("user");
  const { groupId } = c.req.param();
  await deleteGroup(user.id, groupId);
  return c.text("", 200);
});

export default groups;
