module.exports = async function (ctx) {
  await ctx.model({
    name: "group",
    database: "mongodb",
    display: "name",
    schema: {
      name: {
        type: "string",
        required: true,
        unique: true,
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
