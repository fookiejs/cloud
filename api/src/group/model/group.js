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
        role: ["system"],
      },
      update: {
        role: ["system"],
      },
      create: {
        role: ["system"],
      },
      delete: {
        role: ["system"],
      },
      count: {
        role: ["system"],
      },
    },
    mixin: ["cache"],
  });
};
