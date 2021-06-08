import Vue from "vue";
import Vuex from "vuex";
import fookieVue from "fookie-vue"
Vue.use(Vuex);

export default new Vuex.Store({
  state: {},
  mutations: {},
  actions: {},
  modules: {
    fookie: fookieVue.store
  },
});
