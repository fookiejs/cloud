<template>
    <div>
        <v-navigation-drawer permanent app>
            <v-list-item>
                <v-list-item-content>
                    <v-list-item-title class="title">
                        Fookie RP
                    </v-list-item-title>
                    <v-list-item-subtitle> Admin Panel </v-list-item-subtitle>
                </v-list-item-content>
            </v-list-item>
            <v-divider></v-divider>
            <v-list>
                <v-list-group
                    v-for="(menu, i) in menus"
                    :key="i"
                    :prepend-icon="menu.icon ? 'mdi-' + menu.icon : 'mdi-tag'"
                >
                    <template v-slot:activator>
                        <v-list-item-title>{{ menu.name }}</v-list-item-title>
                    </template>

                    <v-list-item
                        v-for="(
                            sub, j
                        ) in $store.state.system_submenu.pool.filter(
                            (s) => s.system_menu == menu._id
                        )"
                        :key="j"
                        link
                        class="ml-5"
                        @click="
                            selected = content(
                                $store.state.system_submenu,
                                sub,
                                'system_model'
                            )
                        "
                    >
                        <v-list-item-icon>
                            <v-icon>mdi-circle-small</v-icon>
                        </v-list-item-icon>
                        <v-list-item-title>{{
                            content(
                                $store.state.system_submenu,
                                sub,
                                "system_model"
                            )
                        }}</v-list-item-title>
                    </v-list-item>
                </v-list-group>
            </v-list>
            <v-divider></v-divider>
            <v-list-item>
                <v-list-item-content>
                    <v-list-item-title> API </v-list-item-title>
                    <v-list-item-subtitle> All Models </v-list-item-subtitle>
                </v-list-item-content>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item
                v-for="(model, k) in $store.state.system_model.pool"
                :key="k"
                link
                dense
                @click="selected = model.name"
            >
                <v-list-item-icon>
                    <v-icon dense>mdi-unfold-more-vertical</v-icon>
                </v-list-item-icon>
                <v-list-item-title>
                    {{ model.name }}
                </v-list-item-title>
                <v-list-item-action>
                    <v-list-item-action-text>{{
                        k + 1
                    }}</v-list-item-action-text>
                </v-list-item-action>
            </v-list-item>
        </v-navigation-drawer>
        <fookie-viewer :model="$store.state[selected]"></fookie-viewer>
    </div>
</template>

<script>
export default {
    data() {
        return {
            selected: "system_model",
        };
    },
    mounted: async function () {
        for (let model of this.$store.state.system_model.pool) {
            this.$store.state[model.name].pool = await this.$store.dispatch(
                "api",
                {
                    method: "getAll",
                    model: model.name,
                }
            );
        }
    },
    methods: {},
    computed: {
        menus() {
            return this.$store.state.system_menu.pool;
        },
    },
};
</script>

<style>
</style>