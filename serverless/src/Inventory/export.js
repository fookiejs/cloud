module.exports = async function (ctx) {
    await ctx.use(require("./model/inventory"))
    await ctx.use(require("./model/item"))
}