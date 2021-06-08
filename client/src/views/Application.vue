<template lang="pug">
v-navigation-drawer(permanent, absolute) 
    v-list-group(v-for="i in 1", :key="i", prepend-icon="mdi-cog")
        template(v-slot:activator="")
            v-list-item-content 
                v-list-item-title Users
</template>

<script>
export default {};
</script>

<style>
</style>