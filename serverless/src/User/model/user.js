module.exports = async function (ctx) {
  await ctx.model({
    name: "user",
    database: "store",
    display: "email",
    schema: {
      firstname: {
        type: "string",
        input: "text",
      },
      lastname: {
        type: "string",
        input: "text",
      },
      email: {
        type: "string",
        required: true,
        input: "text",
      },
      password: {
        type: "string",
        required: true,
        input: "password",
      },
    },
    lifecycle: {
      get: {
        role: ["system"],
      },
      getAll: {
        role: ["system"],
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
        rule: [],
        role: ["system"],
      },
      login: {
        preRule: [
          "default_payload",
          "has_model",
          "has_method",
          "has_password_email",
        ],
      },
    },
    mixin: [],
  });
};
