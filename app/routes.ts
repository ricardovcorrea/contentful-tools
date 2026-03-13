import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  layout("routes/home.tsx", [
    index("routes/home._index.tsx"),
    route("entry/:entryId", "routes/home.entry.tsx"),
    route("overview/:scope/:group?", "routes/home.overview.tsx"),
  ]),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
