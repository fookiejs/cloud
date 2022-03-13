(async () => {
  const mod = require("./src/mod")
  const Fookie = require("fookie");
  await Fookie.init();

  await Fookie.use(require("fookie-server"))
  await Fookie.use(require("fookie-cache").client)  
  await Fookie.use(mod);

  await Fookie.setting({
    name: "mongodb_connection",
    value: [process.env.MONGO]
  })
  

  Fookie.listen(2626)
})()






