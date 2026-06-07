import { defineAuth } from '@aws-amplify/backend';
import { createAdminUser } from "../functions/create-admin-user/resource";
import { listAdminUsers } from "../functions/list-admin-users/resource";
import { resetAdminPassword } from "../functions/reset-admin-password/resource";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  access: (allow) => [
    allow.resource(createAdminUser).to(["createUser"]),
    allow.resource(listAdminUsers).to(["listUsers"]),
    allow.resource(resetAdminPassword).to(["resetUserPassword"]),
  ],
});
