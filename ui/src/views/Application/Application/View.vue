<template lang="pug">
div(:key="$route.params.model")
  v-btn(fab, color="green", dark, fixed, right, bottom)
    v-icon mdi-plus
  div(v-for="entity in pool", :key="entity.name")
    pre {{ entity.name }}
</template>

<script>
export default {
  mounted() {},
  computed: {
    pool: function () {
      let vue = this;
      this.$store.dispatch("api", {
        model: vue.$route.params.model,
        method: "getAll",
      });
      return vue.$store.state[vue.$route.params.model];
    },
  },
};
</script>

<style>
</style>