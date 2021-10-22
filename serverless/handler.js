

module.exports.run = async (event) => {
  const Fookie = require("fookie")
  let fookie = new Fookie()
  await fookie.init()
  await fookie.use(require("./src/mod"))
  if (typeof event.body.system == "boolean") return false
  let body = Object.assign({}, JSON.parse(event.body))
  let res = await fookie.run(body)
  return {
    statusCode: 200,
    body: JSON.stringify(res),
  };
};
