import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { createAdminUser } from "./functions/create-admin-user/resource";
import { listAdminUsers } from "./functions/list-admin-users/resource";
import { resetAdminPassword } from "./functions/reset-admin-password/resource";
import { storage } from "./storage/resource";

defineBackend({
  auth,
  data,
  createAdminUser,
  listAdminUsers,
  resetAdminPassword,
  storage,
});
