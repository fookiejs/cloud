module.exports = async function (ctx) {
  await ctx.model({
    name: "member",
    database: "mongodb",
    schema: {
      role: {
        relation: "role",
        required: true,
      },
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
      count: {
        role: ["system"],
      },
    },
    mixin: ["cache"],
  });
};
