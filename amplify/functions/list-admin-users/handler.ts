import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { Schema } from "../../data/resource";

declare const process: {
  env: {
    AMPLIFY_AUTH_USERPOOL_ID?: string;
  };
};

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: Schema["listAdminUsers"]["functionHandler"] = async () => {
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

  if (!userPoolId) {
    throw new Error("Missing Cognito user pool configuration.");
  }

  const result = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: 60,
    })
  );

  return (
    result.Users?.map((user) => {
      const email =
        user.Attributes?.find((attribute) => attribute.Name === "email")?.Value ??
        user.Username ??
        "";

      return {
        id: user.Username ?? email,
        email,
        status: user.UserStatus ?? "UNKNOWN",
        enabled: user.Enabled ?? false,
        createdAt: user.UserCreateDate?.toISOString(),
      };
    }) ?? []
  );
};
