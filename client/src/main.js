import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import vuetify from "./plugins/vuetify";

Vue.config.productionTip = false;

import fookieVue from "fookie-vue"
Vue.use(fookieVue.plugin)

new Vue({
  router,
  store,
  vuetify,
  render: (h) => h(App),
}).$mount("#app");
