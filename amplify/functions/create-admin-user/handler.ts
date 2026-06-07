import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { Schema } from "../../data/resource";

declare const process: {
  env: {
    AMPLIFY_AUTH_USERPOOL_ID?: string;
  };
};

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: Schema["createAdminUser"]["functionHandler"] = async (
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
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      DesiredDeliveryMediums: ["EMAIL"],
      UserAttributes: [
        {
          Name: "email",
          Value: email,
        },
        {
          Name: "email_verified",
          Value: "true",
        },
      ],
    })
  );

  return {
    email,
    status: "INVITED",
  };
};
