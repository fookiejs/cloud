<<<<<<< HEAD
module.exports = async (event, context, cb) => {
  const F = require("fookie");
  const fookie = new F()
  await fookie.core()
  let payload = JSON.parse(event.body);
  if (typeof payload.system == "boolean") return false;
  await fookie.run(payload)
=======

>>>>>>> a1e8f1a81c96636c373aaa790f51cf597340cf1a

const Fookie = require("fookie")
let fookie = new Fookie()
module.exports.run = async (event) => {


  await fookie.core()
  if (typeof event.body.system == "boolean") return false
  let body = Object.assign({}, JSON.parse(event.body))
  let res = await fookie.run(body)
  return {
    statusCode: 200,
    body: JSON.stringify(res),
  };

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
