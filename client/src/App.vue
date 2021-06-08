<template>
    <v-app>
        <v-app-bar app>
            <v-toolbar-title>Fookie JS</v-toolbar-title>
            <v-spacer></v-spacer>
            <div>
                <v-text-field
                    solo
                    flat
                    prepend-inner-icon="mdi-magnify"
                    single-line
                    placeholder="Search..."
                    hide-details
                ></v-text-field>
            </div>

            <v-btn
                text
                href="https://github.com/umudikk/fookie"
                target="_blank"
            >
                <span class="mr-2">Github</span>
                <v-icon>mdi-github</v-icon>
            </v-btn>
            <v-btn text href="https://discord.gg/XJBTyG73TG" target="_blank">
                <span class="mr-2">Discord</span>
                <v-icon>mdi-discord</v-icon>
            </v-btn>
        </v-app-bar>

        <v-main app>
            <v-container fluid>
                <router-view />
            </v-container>
        </v-main>

        <v-footer app>
            <v-row>
                <v-col class="text-center">
                    {{ new Date().getFullYear() }} —
                    <strong>Fookie JS</strong>
                </v-col>
            </v-row>
        </v-footer>
    </v-app>
</template>

<script>
export default {
    name: "App",

    data: () => ({
        //
    }),
};
</script>
