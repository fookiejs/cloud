module.exports = async function (ctx) {
  await ctx.lifecycle({
    name: "has_password_email",
    function: async function (payload, ctx, state) {
      return ctx.lodash.has(payload.query.filter, "password") && ctx.lodash.has(payload.query.filter, "email")
    },
  });
};
