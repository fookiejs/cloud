module.exports = async (event, context, cb) => {

  const F = require("fookie");
  const fookie = new F()
  await fookie.core()
  let payload = JSON.parse(event.body);
  if (typeof payload.system == "boolean") return false;
  await fookie.run(payload)

  return {
    statusCode: 200,
    body: JSON.stringify(payload.response),
  }
};



