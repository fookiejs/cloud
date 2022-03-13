const { sha512 } = require("js-sha512");
const jwt = require("jsonwebtoken");

module.exports = async function (ctx) {
  let user = ctx.local.get("model", "user")

  user.methods.login = async function (payload, ctx, state) {
    let res = await ctx.run({
      system: true,
      model: "user",
      method: "read",
      query: {
        filter: {
          email: payload.query.filter.email,
          password: sha512(payload.query.filter.password),
        }
      },
    });
    if (res.data.length > 0) {
      payload.response.data = {
        token: jwt.sign(res.data[0], process.env.SYSTEM_TOKEN)
      }
    } else {
      payload.response.data = {}
      payload.response.status = false
    }
  }

  user.lifecycle.login = {
    preRule: ["valid_payload", "default_payload", "has_model", "has_method"],
    role: [],
    rule: [],
    modify: [],
    effect: [],
    filter: []
  }
  ctx.local.set("model", user)
};
