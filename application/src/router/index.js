import Vue from "vue";
import VueRouter from "vue-router";
import Login from "../views/Login.vue";
import Setting from "../views/Setting.vue";
import View from "../views/View.vue";
import ApiSetting from "../views/ApiSetting.vue";
import Game from "../views/Game.vue";
import Hud from "../views/Hud.vue";
import App from "../App.vue";

Vue.use(VueRouter);

const routes = [
    {
        path: "/",
        name: "home",
        component: App,
    },
    {
        path: "/login",
        name: "login",
        component: Login,
    },
    {
        path: "/game",
        name: "game",
        component: Game,
        meta: {
            auth: true
        },
        children: [
            {
                path: "view",
                name: "view",
                component: View,
            },
            {
                path: "hud",
                name: "hud",
                component: Hud,
            },
            {
                path: "api",
                name: "api",
                component: ApiSetting,
            },
            {
                path: "setting",
                name: "setting",
                component: Setting,
            }
        ]
    },

]


const router = new VueRouter({
    mode: "history",
    base: process.env.BASE_URL,
    routes,
});



router.afterEach((to, from, next) => {
    if (to.matched.some(record => record.meta.auth)) {
        if (localStorage.getItem('token') == null) {
            next({
                name: 'login',
            })
        }
    }
})
export default router;