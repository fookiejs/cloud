

const mod = require("./src/mod")

module.exports.run = async (event) => {
  //  const Fookie = require("fookie");
  const fookie = require("../../fookie");
  await fookie.core()
  await fookie.init();
  await fookie.use(mod);


  if (typeof event.body.system == "boolean") return false;
  let body = Object.assign({}, JSON.parse(event.body));
  let res = await fookie.run(body);
  return {
    statusCode: 200,
    body: JSON.stringify(res),
  };
};
