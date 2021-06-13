import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import vuetify from "./plugins/vuetify";


import deletee from './components/fookie/fookie-delete.vue'
import viewer from './components/fookie/fookie-viewer.vue'
import filter from './components/fookie/fookie-filter.vue'
import fookiePost from './components/fookie/fookie-post.vue'
import field from './components/fookie/fookie-field.vue'

Vue.component('fookie-delete', deletee)
Vue.component('fookie-viewer', viewer)
Vue.component('fookie-post', fookiePost)
Vue.component('fookie-filter', filter)
Vue.component('fookie-field', field)
import fookie from "./plugins/fookie_mixin.js";

import VJsoneditor from 'v-jsoneditor/src/index'

Vue.use(VJsoneditor)

Vue.config.productionTip = false;

Vue.mixin(fookie)
const app = new Vue({
    router,
    store,
    vuetify,
    render: h => h(App)
}).$mount("#app");

window.app = app
global.app = app