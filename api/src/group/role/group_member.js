module.exports = async function (ctx) {
  await ctx.role({
    name: "group_member",
    function: async function (payload, ctx, state) {
      const user_model = ctx.local.get("model", "user");
      const user_db = ctx.local.get("database", user_model.database);
      let res = await ctx.run({
        token: true,
        model: "member",
        method: "count",
        query: {
          filter: {
            group: payload.body.group,
            user: state.user[user_db.pk],
          }
        }
      })
      return res.data > 0
    },
  });
};
