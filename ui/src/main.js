import Vue from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import store from './store'
import router from './router'

Vue.component("fookie-view")
Vue.component("fookie-post")
Vue.component("fookie-field")
Vue.component("fookie-delete")

Vue.config.productionTip = false

new Vue({
  vuetify,
  store,
  router,
  render: h => h(App)
}).$mount('#app')
