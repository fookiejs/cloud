<template>
    <div class="">
        <v-sheet
            height="800"
            width="400"
            class="flex overflow-scroll flex-wrap border"
            color="green lighten-2"
        >
            <draggable
                class="border"
                v-bind="{
                    animation: 350,
                    group: 'item',
                }"
                v-model="items"
            >
                <transition-group
                    type="transition"
                    name="flip-list"
                    class="d-flex gap-1 justify-start flex-wrap"
                >
                    <div
                        v-for="i in items"
                        :key="i + '_item'"
                        class="h-16 w-16 border-2 border-red-600"
                    >
                        {{ list[i - 1] }}
                    </div>
                </transition-group>
            </draggable>
        </v-sheet>
    </div>
</template>

<script>
import draggable from "vuedraggable";
export default {
    props: ["selectedId"],
    methods: {
        onUnpublishedChange(evt) {
            console.info(evt);
            return false;
        },
    },
    data() {
        return {};
    },
    components: {
        draggable,
    },
    computed: {
        items() {
            return this.$store.state.item.pool.filter(
                (i) => i.inventory == this.selectedId
            );
        },
    },
};
</script>

<style>
</style>