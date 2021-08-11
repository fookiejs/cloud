
const F = require("fookie");
const fookie = new F()


module.exports.hello = async (event, context, cb) => {
  await fookie.core()
  let payload = JSON.parse(event.body);
  if (typeof payload.system == "boolean") return false;
  await fookie.run(payload)

  return {
    statusCode: 200,
    body: JSON.stringify(payload.response),
  }
};



