module.exports = async function (ctx) {
  await ctx.model({
    name: "member",
    database: "mongodb",
    display: "name",
    schema: {
      group: {
        relation: "group",
        required: true,
      },
      user: {
        relation: "user",
        required: true,
      },
      role: {
        type: "string",
        required: true,
        default: "member",
      },
    },
    lifecycle: {
      read: {
        role: [],
        modify: []
      },
      update: {
        role: [],
        modify: [],
      },
      create: {
        role: [],
        modify: [],
      },
      delete: {
        role: [],
      },
      count: {
        role: [],
      }
    },
    mixin: ["cache"],
  });
};
