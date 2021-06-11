
<template>
    <v-dialog v-model="dialog" width="700">
        <template v-slot:activator="{ on, attrs }">
            <v-btn v-bind="attrs" v-on="on" color="error" dark>
                <v-icon>mdi-delete</v-icon>
            </v-btn>
        </template>
        <v-card>
            <v-card-title>
                <span class="headline">Sil {{ model.name }}</span>
            </v-card-title>
            <v-card-text> Sil ID:{{ selectedId }}</v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="red darken-1" text @click="del"> DELETE</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>




<script>
export default {
    props: ["model", "selectedId"],
    data() {
        return {
            dialog: false,
        };
    },
    methods: {
        del: async function () {
            this.dialog = false;

            let model = this.model.name;
            let _id = this.selectedId;

            this.$store.dispatch("api", {
                method: "delete",
                model,
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
