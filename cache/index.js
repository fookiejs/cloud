(async () => {
    const fookie = require("../../core");
    await fookie.init()
    await fookie.use(require("../../server"))
    await fookie.use(require("../../cache").server)
    await fookie.listen(2630)
})()