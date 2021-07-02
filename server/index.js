const Fookie = require("../../fookie/fookie")
const fookie = new Fookie()

let start = async function () {
    await fookie.connect('mongodb://mongo/fookie')
    fookie.model(require("./src/documentation/model/page.js"))
    fookie.listen(3000)
}
start()