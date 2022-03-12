module.exports = async function (ctx) {
    await ctx.use(require("./Chat/export"))
    await ctx.use(require("./Note/export"))
    await ctx.use(require("./Team/export"))
}