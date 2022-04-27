module.exports = async function (ctx) {
  await ctx.lifecycle({
    name: "set_user",
    function: async function (payload, ctx, state) {
      if (payload.token) {
        try {
          state.user = jwt.verify(payload.token, process.env.SYSTEM_TOKEN);
        } catch (error) {
          console.log("Invalid token");
        }
      }
    }
  })
};
