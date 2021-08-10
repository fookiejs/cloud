<script>
import Vue from 'vue';

export default Vue.extend({
    props: ['model', 'selectedId'],
});
</script>

<template lang='pug'>
    v-btn(dark color='blue' fab small @click='$router.push({name:"panel",params:{_id:selectedId,_model:model}})')
        v-icon(dark) mdi-door-open
</template>
