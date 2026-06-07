import {
  AdminResetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { Schema } from "../../data/resource";

declare const process: {
  env: {
    AMPLIFY_AUTH_USERPOOL_ID?: string;
  };
};

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: Schema["resetAdminPassword"]["functionHandler"] = async (
  event
) => {
  const email = event.arguments.email.trim().toLowerCase();
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

  if (!userPoolId) {
    throw new Error("Missing Cognito user pool configuration.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  await cognitoClient.send(
    new AdminResetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
    })
  );

  return {
    email,
    status: "RESET_SENT",
  };
};
