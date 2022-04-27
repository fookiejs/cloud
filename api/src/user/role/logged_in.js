module.exports = async function (ctx) {
  await ctx.lifecycle({
    name: "logged_in",
    function: async function (payload, ctx, state) {
      return ctx.lodash.has(state, "user");
    },
  });
};
