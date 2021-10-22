module.exports = async function (ctx) {
    await ctx.use(require("./model/user"))
    await ctx.use(require("./model/admin"))
}