module.exports = async function (ctx) {
    await ctx.use(require("./user/export"))
    await ctx.use(require("./message/export"))
    await ctx.use(require("./event/export"))
    await ctx.use(require("./group/export"))
}