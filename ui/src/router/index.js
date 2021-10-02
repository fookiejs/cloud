import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/application',
    name: 'application',
    component: () => import(/* webpackChunkName: "application" */ '../views/Application/Application.vue'),
    children: [
      {
        path: ':model/view',
        name: 'view',
        component: () => import(/* webpackChunkName: "view" */ '../views/Application/Application/View.vue'),
      },
      {
        path: 'panel',
        name: 'panel',
        component: () => import(/* webpackChunkName: "view" */ '../views/Application/Application/Panel.vue'),
      },
    ]
  },
  {
    path: '/auth',
    name: 'auth',
    component: () => import(/* webpackChunkName: "auth" */ '../views/Auth/Auth.vue'),
    children: [

    ]
  },
  {
    path: '/about',
    name: 'about',
    component: () => import(/* webpackChunkName: "about" */ '../views/About/About.vue'),
    children: [

    ]
  },
]


const router = new VueRouter({
  routes,
  mode: 'history',
})

export default router
