import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    menu: [
      {
        _id: 1,
        title: "Manifest",
        icon: "mdi-book-open-blank-variant",
        sub: ["Why Fookie Js", "Test", "Benefits", "Limitation"]
      },
      {
        _id: 2,
        title: "Get Started",
        icon: "mdi-nodejs",
        sub: ["Installation", "Hello World", "Basics", "Postman Example"]
      },
      {
        _id: 3,
        title: "Request Life Cycle",
        icon: "mdi-sync",
        sub: ["Concept", "Pre Rules", "Modify", "Rule", "Role", "Method", "Filter", "Effect"]
      },
      {
        _id: 4,
        title: "Plugin",
        icon: "mdi-connection",
        sub: ["Add a Plugin", "Custom Method"]
      },
      {
        _id: 5,
        title: "About",
        icon: "mdi-help-circle",
        sub: []
      },
    ],
  },
  mutations: {},
  actions: {},
  modules: {},
});
