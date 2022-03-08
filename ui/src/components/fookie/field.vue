<template lang="pug">
.flex
  div {{ keyName }}
  v-spacer
  pre {{ entity[keyName] }}
</template>

<script>
export default {
  props: ["model", "keyName", "entity"],
};
</script>

<style>
</style>