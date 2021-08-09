"use strict";
let Fookie = require("fookie")
const fookie = new Fookie()
module.exports.hello = async (event) => {
  return {
    statusCode: 200,
    body: fookie.package,
  }
};