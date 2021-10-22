module.exports = async function (ctx) {
    await require("./model/user")(ctx)
    await require("./model/admin")(ctx)
}