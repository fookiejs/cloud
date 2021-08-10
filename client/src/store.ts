import Vue from "vue";
import Vuex from "vuex";
import { request } from "@/util/request";
import urlParser from "./util/urlParser";
import axios from "axios";
import { Auth } from "aws-amplify";
import fix_body from "@/util/fix_body";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    selectedCompany: null,
    system_user: null,
    model: [],
    logs: [],
    snackbar: {
      text: "Ok",
      opened: false,
      color: "#2db300",
    },
    rules: {
      required: function (field: any): Function {
        return ((v: any) => !!v || "required");
      },
      min: function (field: any): Function {
        return ((v: any) => v > field.min || "min");
      },
      max: function (field: any): Function {
        return ((v: any) => v < field.max || "max");
      },
      equal: function (field: any): Function {
        return ((v: any) => v == field.equal || "equal");
      },
      maxSize: function (field: any): Function {
        return ((v: any) =>
          (v ? field.maxSize >= v?.size : true) || "maxSize_err");
      },
    },
  },
  mutations: {
    setUser(state: any, payload) {
      state.system_user = payload;
    },
    get(state: any, payload) {
      /*state[payload.model].pool = _.uniqBy(state[payload.model].pool.concat(payload.response.data), '_id');*/
      state[payload.model] = payload.response.data;
    },
    getAll(state: any, payload) {
      /*state[payload.model].pool = _.uniqBy(state[payload.model].pool.concat(payload.response.data), '_id');*/
      state[payload.model] = payload.response.data;
    },
    post(state: any, payload) {
      state[payload.model] = state[payload.model].filter((i: any) =>
        i._id != payload.response.data._id
      );
      state[payload.model].push(payload.response.data);
    },
    remove(state: any, payload) {
      state[payload.model] = state[payload.model].filter((i: any) =>
        i._id != payload.path[0]
      );
    },
    patch(state: any, payload) {
      let obj = state[payload.model].find((i: any) =>
        i._id == payload.body._id
      );
      for (let i in obj) {
        obj[i] = payload.body[i];
      }
    },
    schema(state: any, payload) {
      state[payload.model].schema = payload.response.data.schema;
      state[payload.model].display = payload.response.data.display;
      state[payload.model].fookie = payload.response.data.fookie;
    },
    snackbar(state, payload) {
      state.snackbar = {
        opened: true,
        text: payload.text,
        color: payload.color,
      };
    },
  },
  actions: {
    relation_models(ctx, model) {
      return ctx.state.model.filter((m: any) =>
        JSON.stringify(m).includes(`"relation":"${model.name}"`)
      );
    },
    api: async function (ctx, payload) {
      if (payload.method == "post" || payload.method == "patch") {
        await fix_body(ctx.state[payload.model], payload.body, ctx);
      }
      payload.system="admin"
      payload.response = await axios.post(
        "http://localhost:2626",
        payload,
      )
        .catch((e: any) => e.response);
      await ctx.dispatch("apiSync", payload);
      return payload.response.data;
    },
    apiSync(ctx, payload) {
      if (payload.response.status < 400 && payload.response.status > 199) {
        if (payload.method == "delete") payload.method = "remove";

        ctx.commit(payload.method, payload);
        ctx.commit("snackbar", {
          color: "#2db300",
          text:
            `Method:${payload.method.toUpperCase()} | Model:${payload.model}`,
        });
      } else {
        ctx.commit("snackbar", {
          color: "#cc3300",
          text:
            `Status:${payload.response.status} | Method:${payload.method} | Model:${payload.model}`,
        });
      }
    },
  },
});
