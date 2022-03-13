module.exports = async function (ctx) {
  await ctx.model({
    name: "system",
    database: "mongodb",
    display: "user",
    schema: {
      user: {
        relation: "user",
        required: true,
      },
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
    },
    mixin: ["cache"],
  });
};
