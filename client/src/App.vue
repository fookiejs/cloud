<script>
import Vue from 'vue';
export default Vue.extend({
    name: 'App',
});
</script>

<template lang='pug'>
    div
        router-view
        v-snackbar(v-model='$store.state.snackbar.opened' color="#00b300" :timeout='2000' right) {{ $store.state.snackbar.text }}
</template>
