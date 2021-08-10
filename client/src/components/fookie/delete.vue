<script>
import Vue from 'vue';

export default Vue.extend({
    props: ['model', 'selectedId'],
    data() {
        return {
            dialog: false,
        };
    },
    methods: {
        del: async function() {
            this.dialog = false;
            let model = this.model.name;
            let _id = this.selectedId;
            await this.$store.dispatch('api', {
                method: 'delete',
                model,
                path: [_id],
            });
        },
    },
});
</script>

<template lang='pug'>
    v-dialog(v-model='dialog' width='700')
        template(v-slot:activator='{ on, attrs }')
            v-btn(small icon v-bind='attrs' v-on='on' color='error' dark fab)
                v-icon mdi-delete
        v-card
            v-card-title
                span.headline Sil {{ model.name }}
            v-card-text  Sil ID:{{ selectedId }}
            v-card-actions
                v-spacer
                v-btn(color='red darken-1' text @click='del')  {{$t('delete')}}
</template>


