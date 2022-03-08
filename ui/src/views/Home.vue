<template lang="pug">
v-app(app)
  v-navigation-drawer(v-model="drawer", app)
    v-list
      v-list-item(
        v-for="model in $store.state.model",
        :key="model.name",
        link,
        :to="{name:'view', params: { model: model.name } }"
      )
        v-list-item-content
          v-list-item-title {{ model.name }}
  v-app-bar(app)
    v-app-bar-nav-icon(@click="drawer = !drawer")
    v-toolbar-title Fookie UI

  v-main(app)
    v-container 
      router-view
</template>

<script>
export default {
  name: "Home",
  data() {
    return {
      drawer: true,
    };
  },
  components: {},
};
</script>
