module.exports = async function (ctx) {
    await require("./model/wallet")(ctx)
}