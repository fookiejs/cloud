import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/application',
    name: 'Application',
    component: () => import(/* webpackChunkName: "application" */ '../views/Application/Application.vue'),
    children: [
      {
        path: 'view',
        name: 'View',
        component: () => import(/* webpackChunkName: "view" */ '../views/Application/Application/View.vue'),
      },
      {
        path: 'panel',
        name: 'Panel',
        component: () => import(/* webpackChunkName: "view" */ '../views/Application/Application/Panel.vue'),
      },
    ]
  },
  {
    path: '/auth',
    name: 'Auth',
    component: () => import(/* webpackChunkName: "auth" */ '../views/Auth/Auth.vue'),
    children: [

    ]
  },
  {
    path: '/about',
    name: 'About',
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
