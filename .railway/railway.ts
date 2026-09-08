import { defineRailway, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    build: "npm run build",
    start: "npx vite preview --host 0.0.0.0 --port $PORT",
    healthcheck: "/",
  });

  return project("prateleira-3d", {
    resources: [web],
  });
});
