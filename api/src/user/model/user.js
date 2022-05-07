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
        modify: []
      },
      update: {
        role: ["system"],
        modify: ["hash_password"],
      },
      create: {
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
