module.exports = async function (ctx) {
  await ctx.model({
    name: "user",
    database: "mongodb",
    schema: {
      email: {
        type: "string",
        required: true,
        unique: true,
      },
      password: {
        type: "string",
        required: true,
        read: ["nobody"]
      },
      code: {
        type: "string",
      }
    },
    lifecycle: {
      read: {
        role: ["system"],
      },
      update: {
        role: ["system"],
        modify: ["hash_password"],
      },
      create: {
        rule: [],
        role: ["system"],
        modify: ["hash_password"],
      },
      delete: {
        role: ["system"],
      },
      count: {
        role: ["system"],
      },
      login: {
        preRule: ["has_password_email"],
      }
    },
    mixin: ["cache"],
  });
};
