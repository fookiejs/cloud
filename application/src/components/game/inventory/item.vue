<template>
    <v-sheet dark height="98" width="97" color="grey darken-2">
        <div>type: {{ item.item_type }}</div>
        <div>id: {{ item._id }}</div>
        <div>x{{ item.amount }}</div>
    </v-sheet>
</template>

<script>
export default {
    props: ["item"],
};
</script>

<style>
</style>