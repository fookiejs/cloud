const jwt = require("jsonwebtoken");
const { sha512 } = require("js-sha512");
const user = require("./model/user");

module.exports = async function (ctx) {
  await ctx.use(require("./model/user"));
  await ctx.use(require("./model/admin"));
  await ctx.use(require("./rule/admin_required"));
  await ctx.use(require("./rule/has_password_email"));
  await ctx.use(require("./modify/hash_password"));

  let res = await ctx.run({
    system: true,
    model: "model",
    method: "read",
    query: {
      name: "user",
    },
  });
  let user_model = res.data[0];

  user_model.methods.set("login", async ({ body, response }, ctx) => {
    let { email, password } = body;

    let res = await ctx.run({
      system: true,
      model: "user",
      method: "count",
      query: {
        email,
        password: sha512(password),
      },
    });
    console.log(res);
    if (res.data > 0) {
      const token = jwt.sign(res.data, ctx.store.get("secret"));
      return token;
    } else {
      response.status = false;
      response.warnings.push("Login error");
    }
  });

  await ctx.run({
    system: true,
    model: "model",
    method: "update",
    query: {
      name: "user",
    },
    body: {
      methods: user.methods,
    },
  });

  ctx.rule("admin_required", async function (payload, ctx) {
    let res = await ctx.run({
      system: true,
      method: "count",
      model: "admin",
    });

    return res.data > 1;
  });
};
