import { defineFunction } from "@aws-amplify/backend";

export const createAdminUser = defineFunction({
  name: "create-admin-user",
  entry: "./handler.ts",
  timeoutSeconds: 10,
  resourceGroupName: "auth",
});
