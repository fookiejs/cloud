const { sha512 } = require("js-sha512");
module.exports = async function (ctx) {
  await ctx.lifecycle({
    name: "hash_password",
    function: async function (payload, ctx, state) {
      if (ctx.lodash.has(payload.body, "password")) {
        payload.body.password = sha512(payload.body.password);
      }
    },
  });
};
