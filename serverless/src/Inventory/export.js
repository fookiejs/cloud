module.exports = async function (ctx) {
    await require("./model/inventory")(ctx)
    await require("./model/item")(ctx)
}