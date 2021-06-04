let Fookie = require('fookie')
const api = new Fookie()

let start = async function(){
    await api.connect('mongodb://mongo/fookie') 
    api.listen(8080)
}
start()