const mod = require("./src/mod")

module.exports.run = async (event) => {
  const Fookie = require("fookie");

  await Fookie.init();
  await Fookie.use(mod);

  if (typeof event.body.system == "boolean") return false;
  let body = Object.assign({}, JSON.parse(event.body));
  let res = await Fookie.run(body);
  return {
    statusCode: 200,
    body: JSON.stringify(res),
  };
};
