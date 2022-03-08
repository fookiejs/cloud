module.exports = async function (ctx) {
  await ctx.rule({
    name: "has_password_email",
    function: async function (payload, ctx) {
      return (
        ctx.lodash.has(payload.body, "password") &&
        ctx.lodash.has(payload.body, "email")
      );
    },
  });
};
