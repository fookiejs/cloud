
<template>
    <div>
        <v-toolbar class="my-3">
            <v-text-field
                v-model="search"
                clearable
                flat
                hide-details
                label="Search"
                prepend-inner-icon="mdi-magnify"
                solo
            ></v-text-field>

            <v-toolbar-title>{{ model.name }}</v-toolbar-title>
            <v-spacer></v-spacer>
            <fookie-post :model="model" />
        </v-toolbar>
        <v-data-iterator
            :items="items"
            :search="search"
            disable-pagination
            hide-default-footer
        >
            <template v-slot:default="props">
                <v-row>
                    <v-col
                        v-for="(item, i) in props.items"
                        :key="i"
                        cols="12"
                        md="3"
                        sm="6"
                    >
                        <v-card
                            style="max-height: 720px"
                            class="overflow-scroll"
                        >
                            <v-card-title>{{
                                item[model.display]
                            }}</v-card-title>

                            <v-divider></v-divider>

                            <v-list dense>
                                <v-list-item v-for="(key, i) in keys" :key="i">
                                    <v-list-item-content>
                                        {{ key }}:
                                    </v-list-item-content>
                                    <v-list-item-content class="align-end">
                                        {{ getContent(item, key) }}
                                    </v-list-item-content>
                                </v-list-item>
                            </v-list>
                            <v-card-actions class="card-action">
                                <v-btn-toggle mandatory dark>
                                    <fookie-post
                                        :model="model"
                                        :selectedId="item._id"
                                    />
                                    <fookie-delete
                                        :model="model"
                                        :selectedId="item._id"
                                    />
                                </v-btn-toggle>
                            </v-card-actions>
                        </v-card>
                    </v-col>
                </v-row>
            </template>
        </v-data-iterator>
    </div>
</template>


<script>
export default {
    props: ["model", "query", "filters"],
    data() {
        return {
            itemsPerPageArray: [4, 8, 12],
            search: "",
            filter: {},
            page: 1,
            itemsPerPage: 4,
        };
    },
    computed: {
        items() {
            return this.model.pool;
        },
        keys() {
            return ["_id"].concat(Object.keys(this.model.schema));
        },
    },
    methods: {
        getContent(item, key) {
            if (key == "_id") return item[key];
            if (typeof this.model.schema[key].relation === "string") {
                let maybe = this.$store.state[
                    this.model.schema[key].relation
                ].pool.find((i) => i._id == item[key]);
                if (!maybe) return "-";
                return maybe[
                    this.$store.state[this.model.schema[key].relation].display
                ];
            }
            return item[key] || "--";
        },
    },
};
</script>

<style lang="scss">
.card-action {
    flex-direction: row-reverse;
}
</style>
