(async () => {
  const fookie = require("../../core");
  await fookie.init();
  const mod = require("./src/mod")
  await fookie.use(require("../../server"))
  await fookie.use(require("../../cache").client)

  await fookie.setting({
    name: "mongodb_connection",
    value: {
      url: process.env.MONGO
    }
  })
  await fookie.use(require("../../databases").mongodb)
  await fookie.use(mod);
  fookie.listen(2626)

  await fookie.run({
    token: true,
    model: "message",
    method: "create",
    body: {
      text: "yoo-" + Date.now()
    }
  })
})()






