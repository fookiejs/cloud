module.exports = async function (ctx) {
    await ctx.use(require("./model/room"))
    await ctx.use(require("./model/message"))
    await ctx.use(require("./model/room_member"))
}