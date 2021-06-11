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
import card from './components/fookie/fookie-card.vue'
import inventory from './components/game/inventory/inventory.vue'
import move from './components/game/move/move.vue'
import item from './components/game/inventory/item.vue'
import phone from './components/game/phone/phone.vue'


Vue.component('fookie-delete', deletee)
Vue.component('fookie-viewer', viewer)
Vue.component('fookie-post', fookiePost)
Vue.component('fookie-filter', filter)
Vue.component('fookie-field', field)
Vue.component('fookie-card', card)
Vue.component('game-inventory', inventory)
Vue.component('game-move', move)
Vue.component('game-item', item)
Vue.component('game-phone', phone)
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