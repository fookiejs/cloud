<template>
    <v-expansion-panels>
        <v-expansion-panel v-for="(log, i) in logs" :key="i">
            <v-expansion-panel-header>
                [{{ log.index }}] {{ log.title }}
            </v-expansion-panel-header>
            <v-expansion-panel-content>
                {{ log.body }}
            </v-expansion-panel-content>
        </v-expansion-panel>
    </v-expansion-panels>
</template>

<script>
export default {
    data() {
        return {
            test: null,
        };
    },
    mounted: async function () {},
    computed: {
        logs() {
            return this.$store.state.logs;
        },
    },
};
</script>

<style>
</style>