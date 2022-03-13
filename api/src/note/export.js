module.exports = async function (ctx) {
    await ctx.use(require("./model/event"))
    await ctx.use(require("./model/event_member"))
}