module.exports = async function (ctx) {
  await ctx.rule({
    name: "admin_required",
    function: async function (payload, ctx) {
      return (
        ctx.lodash.has(payload.boyd, "password") &&
        ctx.lodash.has(payload.boyd, "email")
      );
    },
  });
};
