import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  layout("routes/home.tsx", [
    index("routes/home._index.tsx"),
    route("environment", "routes/home.environment.tsx"),
    route("entry/:entryId", "routes/home.entry.tsx"),
    route("overview/:scope/:group?", "routes/home.overview.tsx"),
    route("locales", "routes/home.locales.tsx"),
    route("locales/:code", "routes/home.locales.$code.tsx"),
  ]),
  route("login", "routes/login.tsx"),
  route(".well-known/*", "routes/well-known.ts"),
] satisfies RouteConfig;
