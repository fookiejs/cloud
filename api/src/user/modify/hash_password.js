const sha256 = require("crypto-js/sha256");
module.exports = async function (ctx) {
  await ctx.lifecycle({
    name: "hash_password",
    function: async function (payload, ctx, state) {
      if (ctx.lodash.has(payload.body, "password")) {
        payload.body.password = sha256(payload.body.password);
      }
    },
  });
};
