module.exports = async function (ctx) {
    await ctx.use(require("./User/export"))
    await ctx.use(require("./Payment/export"))
    await ctx.use(require("./Inventory/export"))
    await ctx.use(require("./Chat/export"))
    await ctx.use(require("./Calendar/export"))
    await ctx.use(require("./User/export"))
}