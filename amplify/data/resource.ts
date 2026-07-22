import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { createAdminUser } from "../functions/create-admin-user/resource";
import { listAdminUsers } from "../functions/list-admin-users/resource";
import { resetAdminPassword } from "../functions/reset-admin-password/resource";

const schema = a.schema({
  AdminUser: a.customType({
    id: a.string().required(),
    email: a.email().required(),
    status: a.string().required(),
    enabled: a.boolean().required(),
    createdAt: a.datetime(),
  }),

  CreateAdminUserResult: a.customType({
    email: a.email().required(),
    status: a.string().required(),
  }),

  createAdminUser: a
    .mutation()
    .arguments({
      email: a.email().required(),
    })
    .returns(a.ref("CreateAdminUserResult"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(createAdminUser)),

  listAdminUsers: a
    .query()
    .returns(a.ref("AdminUser").array())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(listAdminUsers)),

  resetAdminPassword: a
    .mutation()
    .arguments({
      email: a.email().required(),
    })
    .returns(a.ref("CreateAdminUserResult"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(resetAdminPassword)),

  Tournament: a
    .model({
      name: a.string().required(),
      passcode: a.string().required(),
      defaultPoints: a.integer().required(),
      allowOverPoints: a.boolean().default(false),
      pointDollarValue: a.float().default(0),
      isOpen: a.boolean().default(true),
      startDate: a.date(),
      endDate: a.date(),

      participants: a.hasMany("Participant", "tournamentId"),
      giftItems: a.hasMany("GiftItem", "tournamentId"),
    })
    .secondaryIndexes((index) => [
      index("passcode"),
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

  Participant: a
    .model({
      tournamentId: a.id().required(),

      firstName: a.string().required(),
      lastName: a.string().required(),
      email: a.email().required(),
      memberNumber: a.string().required(),

      startingPoints: a.integer().required(),
      hasSubmittedOrder: a.boolean().default(false),
      submittedAt: a.datetime(),

      tournament: a.belongsTo("Tournament", "tournamentId"),
      cartItems: a.hasMany("CartItem", "participantId"),
      orders: a.hasMany("Order", "participantId"),
    })
    .secondaryIndexes((index) => [
      index("tournamentId"),
      index("email"),
      index("memberNumber"),
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

  GiftItem: a
    .model({
      tournamentId: a.id().required(),

      title: a.string().required(),
      description: a.string(),
      imageKey: a.string(),
      imageUrl: a.string(),

      pointCost: a.integer().required(),
      quantityAvailable: a.integer(),
      sortOrder: a.integer(),
      optionLabel: a.string(),
      optionValues: a.string(),
      colorOptions: a.string(),
      isActive: a.boolean().default(true),

      tournament: a.belongsTo("Tournament", "tournamentId"),
      cartItems: a.hasMany("CartItem", "giftItemId"),
      orderItems: a.hasMany("OrderItem", "giftItemId"),
      giftImages: a.hasMany("GiftImage", "giftItemId"),
    })
    .secondaryIndexes((index) => [
      index("tournamentId"),
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

    GiftImage: a
    .model({
      tournamentId: a.id().required(),
      giftItemId: a.id().required(),

      imageKey: a.string().required(),
      altText: a.string(),
      sortOrder: a.integer(),
      isPrimary: a.boolean().default(false),
      colorOptionId: a.string(),

      giftItem: a.belongsTo("GiftItem", "giftItemId"),
    })
    .secondaryIndexes((index) => [
      index("giftItemId"),
      index("tournamentId"),
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
  ]),

  CartItem: a
    .model({
      tournamentId: a.id().required(),
      participantId: a.id().required(),
      giftItemId: a.id().required(),

      quantity: a.integer().required(),
      pointCostAtTime: a.integer().required(),
      selectedOption: a.string(),
      selectedOptionLabel: a.string(),
      selectedColorId: a.string(),
      selectedColorName: a.string(),
      selectedColorHex: a.string(),

      participant: a.belongsTo("Participant", "participantId"),
      giftItem: a.belongsTo("GiftItem", "giftItemId"),
    })
    .secondaryIndexes((index) => [
      index("participantId"),
      index("tournamentId"),
      index("giftItemId"),
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

  Order: a
    .model({
      tournamentId: a.id().required(),
      participantId: a.id().required(),

      totalPointsUsed: a.integer().required(),
      status: a.string().required(),
      submittedAt: a.datetime().required(),

      participant: a.belongsTo("Participant", "participantId"),
      orderItems: a.hasMany("OrderItem", "orderId"),
    })
    .secondaryIndexes((index) => [
      index("participantId"),
      index("tournamentId"),
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),

  OrderItem: a
    .model({
      orderId: a.id().required(),
      giftItemId: a.id().required(),

      titleAtTime: a.string().required(),
      descriptionAtTime: a.string(),
      pointCostAtTime: a.integer().required(),
      selectedOptionAtTime: a.string(),
      selectedOptionLabelAtTime: a.string(),
      selectedColorIdAtTime: a.string(),
      selectedColorNameAtTime: a.string(),
      selectedColorHexAtTime: a.string(),
      quantity: a.integer().required(),

      order: a.belongsTo("Order", "orderId"),
      giftItem: a.belongsTo("GiftItem", "giftItemId"),
    })
    .secondaryIndexes((index) => [
      index("orderId"),
      index("giftItemId"),
    ])
    .authorization((allow) => [
      allow.publicApiKey(),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
