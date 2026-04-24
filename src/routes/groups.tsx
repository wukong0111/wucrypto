import { Hono } from "hono";
import { createGroup, deleteGroup, listGroups } from "../lib/storage";
import HomeView, { GroupItem } from "../views/home";
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
    c.header("HX-Retarget", "#new-group-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span>Name is required</span>, 400);
  }
  const group = await createGroup(name);
  return c.html(<GroupItem group={group} />);
});

groups.delete("/groups/:groupId", async (c) => {
  const { groupId } = c.req.param();
  await deleteGroup(groupId);
  return c.text("", 200);
});

export default groups;
