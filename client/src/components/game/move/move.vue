<template>
    <v-card>
        <v-card-title>Move </v-card-title>
        <v-card-text>
            <v-btn @click="patch('x', -0.1)">-</v-btn>x<v-btn
                @click="patch('x', +0.1)"
                >+</v-btn
            >
        </v-card-text>

        <v-card-text>
            <v-btn @click="patch('y', -0.1)">-</v-btn>y<v-btn
                @click="patch('y', +0.1)"
                >+</v-btn
            >
        </v-card-text>

        <v-card-text>
            <v-btn @click="patch('z', -0.1)">-</v-btn>z<v-btn
                @click="patch('z', +0.1)"
                >+</v-btn
            >
        </v-card-text>
    </v-card>
</template>

<script>
export default {
    props: ["selectedId","entity"],
    methods: {
        patch(dim, val) {
            let _id = this.selectedId;
            this.$store.dispatch("api", {
                model: "shop",
                method: "patch",
                body: {
                    position: {
                        [dim]: val,
                    },
                },
                query: {
                    where: {
                        _id,
                    },
                },
            });
        },
    },
};
</script>

<style>
</style>