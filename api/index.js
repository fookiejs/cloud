(async () => {
  const fookie = require("../../core");
  const mod = require("./src/mod")
  await fookie.init();

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
})()






