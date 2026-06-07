import { defineFunction } from "@aws-amplify/backend";

export const resetAdminPassword = defineFunction({
  name: "reset-admin-password",
  entry: "./handler.ts",
  timeoutSeconds: 10,
  resourceGroupName: "auth",
});
