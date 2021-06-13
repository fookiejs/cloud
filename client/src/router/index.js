import Vue from "vue";
import VueRouter from "vue-router";
import Login from "../views/Login.vue";
import View from "../views/View.vue";
import Application from "../views/Application.vue";
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
        path: "/application",
        name: "application",
        component: Application,
        meta: {
            auth: true
        },
        children: [
            {
                path: "view",
                name: "view",
                component: View,
            },              
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