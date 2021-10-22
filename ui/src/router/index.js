import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '../views/Home.vue'
import View from '../views/Application/View.vue'
import Application from '../views/Application.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    children: [
      {
        path: 'application',
        name: 'application',
        component: Application,
        children: [
          {
            path: "view/:model",
            name: 'view',
            component: View,
          },
        ]
      },

    ]
  },

]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
