module.exports = async function (ctx) {

  await ctx.use(require("./model/group"));
  await ctx.use(require("./model/member"));

  await ctx.use(require("./role/group_owner"));
  await ctx.use(require("./role/group_member"));
};
