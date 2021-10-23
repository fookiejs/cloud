module.exports = async function (ctx) {
  await ctx.model({
    name: "admin",
    database: "store",
    display: "user",
    schema: {
      user: {
        relation: "user",
        required: true,
        input: "relation",
      },
    },
    lifecycle: {
      get: {
        preRUle: [],
        modify: [],
        rule: [],
        role: [],
        filter: [],
        effect: [],
      },
      getAll: {
        preRUle: [],
        modify: [],
        rule: [],
        role: [],
        filter: [],
        effect: [],
      },
      update: {
        preRUle: [],
        modify: [],
        rule: [],
        role: [],
        filter: [],
        effect: [],
      },
      create: {
        preRUle: [],
        modify: [],
        rule: [],
        role: [],
        filter: [],
        effect: [],
      },
      delete: {
        preRUle: [],
        modify: [],
        rule: [],
        role: [],
        filter: [],
        effect: [],
      },
      count: {
        preRUle: [],
        modify: [],
        rule: [],
        role: [],
        filter: [],
        effect: [],
      },
    },
    mixin: [],
  });
};
