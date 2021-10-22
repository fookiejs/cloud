module.exports = async function (ctx) {
    await require("./User/export")(ctx)
    await require("./Payment/export")(ctx)
    await require("./Inventory/export")(ctx)
    await require("./Chat/export")(ctx)
    await require("./Callendar/export")(ctx)
}