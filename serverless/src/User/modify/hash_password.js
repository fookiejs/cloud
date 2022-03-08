const sha512 = require("sha512");
module.exports = async function (ctx) {
  await ctx.modify({
    name: "hash_password",
    function: async function (payload, ctx) {
      payload.body.password = sha512(payload.body.password);
    },
  });
};
