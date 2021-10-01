<template lang="pug">
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
    this.$store.dispatch("api", {
      model: "model",
      method: "getAll",
      system: "admin",
    });
  },
};
</script>

<style lang="scss">
</style>
