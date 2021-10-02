<template lang="pug">
v-app(dark)
  v-navigation-drawer(v-model="drawer", app)
    v-list-item All Models
    v-list(dense)
      v-list-item(
        link,
        v-for="i in $store.state.model",
        :key="i.name",
        :to="{ name: 'view', params: { model: i.name } }"
      )
        v-list-item-icon
          v-icon mdi-minus
        v-list-item-content
          v-list-item-title {{ i.name }}
  v-app-bar(app)
    v-app-bar-nav-icon(@click="drawer = !drawer")
    v-toolbar-title Fookie UI
  v-main
    v-container
      router-view
</template>

<script>
export default {
  data() {
    return {
      drawer: null,
    };
  },
  mounted() {
    this.$vuetify.theme.dark = false;
  },
};
</script>


<style lang="scss">
</style>
