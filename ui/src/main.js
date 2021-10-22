import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify'

// Fookie UI
import fookieView from './components/fookie/view'
import fookiePost from './components/fookie/post'
import fookieDelete from './components/fookie/delete'
import fookieField from './components/fookie/field'

Vue.component("fookie-view", fookieView)
Vue.component("fookie-post", fookiePost)
Vue.component("fookie-delete", fookieDelete)
Vue.component("fookie-field", fookieField)

Vue.config.productionTip = false

new Vue({
  router,
  store,
  vuetify,
  render: h => h(App)
}).$mount('#app')
