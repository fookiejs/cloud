

(async () => {
  const F = require("../../fookie");
  const fookie = new F()
  await fookie.core()

  module.exports = async function (event, context, cb) {

    let payload = JSON.parse(event.body);
    console.log(payload);
    if (typeof payload.system === "boolean") return false;
    await fookie.run(payload)

    return {
      statusCode: 200,
      body: JSON.stringify(payload.response),
    }
  };
})()



