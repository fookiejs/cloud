<template lang="pug">
fookie-view(:model="mn")
</template>

<script>
export default {
  data() {
    return {};
  },
  computed: {
    mn() {
      let mn = this.$route.params.model;
      return this.$store.state.model.filter((m) => m.name === mn)[0];
    },
  },
};
</script>

<style>
</style>