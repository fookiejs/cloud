import Vue from 'vue'
import Vuex from 'vuex'
import axios from 'axios'
Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    model: [],
    baseURL: "http://localhost:3000/dev/api",
    snackbar: {
      text: "Ok",
      opened: false,
      color: "success",
    },
    logs: []
  },
  mutations: {
    getAll(state, payload) {
      console.log(payload);
      state[payload.model] = payload.response.data;
    },
    get(state, payload) {
      state[payload.model] = state[payload.model].filter((i) => i._id != payload.response.data._id);
      state[payload.model].push(payload.response.data);
    },
    create(state, payload) {
      state[payload.model] = state[payload.model].filter((i) => i._id != payload.response.data._id);
      state[payload.model].push(payload.response.data);
    },
    remove(state, payload) {
      state[payload.model] = state[payload.model].filter((i) => i._id != payload.query.where._id);
    },
    patch(state, payload) {
      state[payload.model] = state[payload.model].filter((i) => i._id != payload.response.data._id);
      state[payload.model].push(payload.response.data);
    },
    login(state, payload) {
      state.token = payload
      localStorage.setItem("token", payload)

    },
    log(state, payload) {
      state.logs.push({
        index: state.logs.length + 1,
        title: payload.title,
        body: payload.body
      })
    },
    snackbar(state, payload) {
      state.snackbar = {
        opened: true,
        text: payload.text,
        color: payload.color
      }
    },
  },
  actions: {
    api: async function (ctx, payload) {
      payload.token = localStorage.getItem("token")
      ctx.commit("log", {
        title: `REQUEST -> Method:${payload.method} | Model:${payload.model}`,
        body: payload
      })
      let response = await axios.post(ctx.state.baseURL, payload, {
        headers: {
          token: localStorage.getItem("token")
        }
      })
      payload.response = response.data
      ctx.dispatch("apiSync", payload)
      return payload.response.data
    },
    apiSync(ctx, payload) {
      if (payload.response.status == true) {
        if (payload.method === 'delete') payload.method = 'remove'; // delete resevered keyword

        ctx.commit(payload.method, payload);
        ctx.commit("snackbar", { color: "success", text: `Method:${payload.method.toUpperCase()} | Model:${payload.model}` });

      } else {
        ctx.commit("log", {
          title: `Status:${payload.response.status} | Method:${payload.method} | Model:${payload.model}`,
          body: payload.response
        })
        ctx.commit("snackbar", { color: "error", text: `Status:${payload.response.status} | Method:${payload.method} | Model:${payload.model}` });
      }
    },
  },
  modules: {
  }
})
