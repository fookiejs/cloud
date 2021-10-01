<template lang="pug">
v-app
  v-navigation-drawer(v-model="drawer", app)
    v-list
      v-list-item(v-for="i in $store.state.model", :key="i.name", link)
        v-list-item-icon
          v-icon mdi-target
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
};
</script>


<style lang="scss">
</style>
