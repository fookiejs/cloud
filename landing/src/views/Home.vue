<template lang="pug">
    div(class="flex justify-center items-center h-full" style="height:500px;")
        div
            div hi 5
            div(class="text-8xl my-6") Fookie JS
            div(class="flex justify-center space-x-8")
                v-btn(x-large) 
                    v-icon(dark) mdi-nodejs
                    span GET STARTED
                v-btn(
                    x-large,
                    href="https://www.patreon.com/fookie",
                    target="_blank"
                ) 
                    v-icon(dark) mdi-patreon
                    span PATREON        
</template>

<script>
export default {
    components: {},
};
</script>
