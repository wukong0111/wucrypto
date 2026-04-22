import { Hono } from "hono";
import { createGroup, deleteGroup, listGroups } from "../lib/storage";
import HomeView, { GroupItemFragment } from "../views/home";
import Layout from "../views/layout";

const groups = new Hono();

groups.get("/", async (c) => {
  const index = await listGroups();
  return c.html(
    <Layout title="Home">
      <HomeView groups={index.groups} />
    </Layout>,
  );
});

groups.post("/groups", async (c) => {
  const body = await c.req.parseBody();
  const name = String(body["name"] ?? "").trim();
  if (!name) {
    return c.html(<span class="text-red-400 text-sm">Name is required</span>, 400);
  }
  const group = await createGroup(name);
  return c.html(<GroupItemFragment group={group} />);
});

groups.delete("/groups/:groupId", async (c) => {
  const { groupId } = c.req.param();
  await deleteGroup(groupId);
  return c.text("", 200);
});

export default groups;
