module.exports = async function (ctx) {
  await ctx.model({
    name: "group",
    database: "mongodb",
    schema: {
      name: {
        type: "string",
        required: true,
        unique: true,
      },
      color: {
        type: "string",
      }
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