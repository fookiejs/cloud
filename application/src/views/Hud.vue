<template>
    <div class="flex flex-wrap gap-4">
        <div v-for="menu in $store.state.menus" :key="menu">
            <game-inventory
                v-if="menu.type == 'inventory'"
                :selectedId="menu.selectedId"
            />
            <game-move
                v-if="menu.type == 'move'"
                :selectedId="menu.selectedId"
            />
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {};
    },
};
</script>

<style>
</style>