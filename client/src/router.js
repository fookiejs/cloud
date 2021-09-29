import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';
import Login from './views/Login.vue';

Vue.use(VueRouter);

const routes= [
    {
        path: '/login',
        name: 'login',
        component: Login,

    },
    {
        path: '/',
        name: 'application',
        component: () => import('./views/Application.vue'),
        children: [
            {
                path: 'live/',
                name: 'live',
                component: () => import('./views/application/Live.vue'),
            },
            {
                path: '/',
                name: 'home',
                component: () => import('./views/application/Home.vue'),
            },
            {
                path: 'company/:company/dashboard/',
                name: 'companyDashboard',
                component: () => import('./views/application/company/Dashboard.vue'),
            },
            {
                path: ':_model/',
                name: 'view',
                component: () => import('./views/application/View.vue'),
            },
            {
                path: ':_model/:_id/',
                name: 'panel',
                component: () => import('./views/application/Panel.vue'),
            },
        ],
    },
];

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes,
});

router.beforeEach(async (to, route, next) => {
    return next()
    //if (route.fullPath == to.fullPath) return;
    try {
        let authUser = (await Auth.currentAuthenticatedUser());
        if (to.meta['perms'] === undefined) return next();
        let type = authUser.attributes['name'];
        if (to.meta.perms.includes(type)) return next();
    } catch (e) {
        if (to.name !== 'login') {
            return next({ name: 'login' });
        } else return next();
    }
});

export default router;
