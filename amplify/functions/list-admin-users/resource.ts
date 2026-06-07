import { defineFunction } from "@aws-amplify/backend";

export const listAdminUsers = defineFunction({
  name: "list-admin-users",
  entry: "./handler.ts",
  timeoutSeconds: 10,
  resourceGroupName: "auth",
});
