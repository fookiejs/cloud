<template>
    <div :key="$route.query.model">
        <fookie-viewer  v-if="!$store.state.loading" :model="$route.query.model"></fookie-viewer>
    </div>
</template>

<script>
export default {};
</script>

<style>
</style>