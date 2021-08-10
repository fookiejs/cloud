<script>
import { indexOf } from "lodash";
import Vue from "vue";

export default Vue.extend({
  name: "App",
  data() {
    return {
      drawer: true,
      loaded: true,
    };
  },
  computed: {
    companies() {
      return this.$store.state.company;
    },
    company() {
      let u = this.$store.state.system_user;
      return u && u["attributes"]["name"] === "admin"
        ? this.$store.state.selectedCompany
        : u["attributes"]["locale"];
    },
  },
  methods: {
    system_submenu(menu) {
      return this.$store.state.system_submenu.pool.filter(
        (s) => s.system_menu === menu._id
      );
    },
    async signOut() {
      await this.$store.dispatch("signOut");
      await this.$router.push({ name: "login" }).catch((err) => {});
    },
    jump(to) {
      this.$router.push(to).catch(() => {});
    },
  },
  mounted: async function () {
    await this.$store.dispatch("api", {
      system: "admin",
      model: "model",
      method: "getAll",
    });
    for (let model of this.$store.state.model) {
      if (model.name != "model") this.$set(this.$store.state, model.name, []);
    }
  },
});
</script>

<template lang='pug'>
  v-app(v-if='loaded')
    v-app-bar(app)
      v-app-bar-nav-icon(@click='drawer = !drawer')
      router-link(to='/')
        v-img(max-width='100' v-if='!drawer')
      v-breadcrumbs(:items='crumbs')
      v-spacer
      v-spacer
      v-btn(text) Öğren
      v-btn(text) Destek
      v-menu(bottom rounded offset-y)
        template(v-slot:activator='{ on }')
          v-btn(icon v-on='on')
            v-icon(center) mdi-account
        v-card(width='250')
          v-card-title {{$t('account')}}

          v-card-text(v-if='$store.state.system_user')
            em
              p {{$store.state.system_user.attributes.name}}
            strong
              p {{$store.state.system_user.attributes.phone_number}}
          v-divider
          v-card-actions
            v-btn(text @click='signOut' style='flex: 1;')
              v-icon(color='red') mdi-logout
              span {{$t('exit')}}
    v-navigation-drawer(v-model='drawer' app)
      v-list
        v-list-item(class='py-2')
          router-link(to='/')
            v-img( max-width='210' )
        v-divider
        v-list-item(v-for='(model,i) in $store.state.model'
          :key="i+'_appmodel'"
          @click="jump({name:'view',params:{_model:model.name}})"
        )
          v-list-item-icon
            v-icon {{model.icon || 'mdi-api'}}
          v-list-item-content
            v-list-item-title {{ $t(model.name) }}
    v-main.bg-gray-100
      v-container(fluid)
        router-view
    v-footer
      v-row(justify='center' no-gutters)
        v-col.text-center(cols='12')
          div
            span &copy;{{ new Date().getFullYear() }}
            span -
            a(href='https://softcand.com' target='_blank') softcand.com