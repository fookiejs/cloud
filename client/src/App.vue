<template lang="pug">
v-app
    v-app-bar(app) 
        v-toolbar-title Fookie JS
        v-spacer
        div
            v-text-field(
                solo,
                flat,
                prepend-inner-icon="mdi-magnify",
                single-line,
                placeholder="Search...",
                hide-details
            ) 
        v-btn(text, href="https://github.com/umudikk/fookie", target="_blank")
            span.mr-2 Github
            v-icon mdi-github
        v-btn(text, href="https://discord.gg/XJBTyG73TG", target="_blank")
            span.mr-2 Discord
            v-icon mdi-discord
    v-main(app)
        v-navigation-drawer(app) 
            v-list
                v-list-group(
                    v-for="m in menu",
                    :key="m",
                    :prepend-icon="m.icon",
                    no-action
                )
                    template(v-slot:activator="")
                        v-list-item-content
                            v-list-item-title {{ m.title }}
                    v-list-item(
                        v-for="s in m.sub",
                        :key="s",
                        link,
                        dense,
                        @click="$router.push({ name: 'page', params: { slug: s.replaceAll(' ', '-').toLowerCase() } })"
                    )
                        v-list-item-content
                            v-list-item-title {{ s }}
        v-container(fluid)
            router-view 
    v-footer(app)
        v-row
            v-col.text-center
                span {{ new Date().getFullYear() }} —
                strong Fookie JS
</template>

<script>
export default {
    name: "App",
    data() {
        return {};
    },
    computed: {
        menu() {
            return this.$store.state.menu;
        },
    },
};
</script>
