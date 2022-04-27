module.exports = async function (ctx) {
  await ctx.use(require("./model/user"));
  await ctx.use(require("./model/admin"));
  await ctx.use(require("./role/logged_in"));
  await ctx.use(require("./rule/has_password_email"));
  await ctx.use(require("./modify/hash_password"));
  await ctx.use(require("./modify/set_user"));
  await ctx.use(require("./method/login"));

  const before = ctx.local.get("mixin", "before")
  before.object.lifecycle.read.modify.push("set_user")
  before.object.lifecycle.create.modify.push("set_user")
  before.object.lifecycle.update.modify.push("set_user")
  before.object.lifecycle.delete.modify.push("set_user")
  before.object.lifecycle.count.modify.push("set_user")
  before.object.lifecycle.test.modify.push("set_user")


  await ctx.run({
    token: true,
    model: "mixin",
    method: "update",
    query: {
      filter: {
        name: "before"
      }
    },
    body: {
      object: before.object
    }
  })



  await ctx.lifecycle("admin_required", async function (payload, ctx, state) { // TODO ROLE ALTINA AL
    let res = await ctx.run({
      token: true,
      method: "count",
      model: "system",
      query: payload.query
    });

    return res.data > 2;
  });

};
