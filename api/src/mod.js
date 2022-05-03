module.exports = async function (ctx) {
    await ctx.use(require("./user/export"))
    await ctx.use(require("./message/export"))
    await ctx.use(require("./note/export"))
    await ctx.use(require("./group/export"))
}