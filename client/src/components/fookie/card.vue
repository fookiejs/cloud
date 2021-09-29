<script>
import Vue from 'vue';

export default Vue.extend({
    props: ['model', 'query', 'remove', 'patch', 'panel', 'selectedId', 'toggle'],
    data() {
        return {
            itemsPerPageArray: [4, 8, 12],
            search: '',
            filter: {},
            sortDesc: false,
            page: 1,
            itemsPerPage: 4,
            sortBy: null,
            toggle_: this.toggle,
        };
    },
    computed: {
        item() {
            return this.model.pool.find((m) => m._id === this.selectedId);
        },
        keys() {
            return ['_id'].concat(Object.keys(this.model.schema));
        },
    },
    methods: {
        getContent(key) {
            if (key === '_id') return this.item[key];
            if (typeof this.model.schema[key].relation === 'string') {
                let maybe = this.$store.state[
                    this.model.schema[key].relation
                    ].pool.find((i) => i._id === this.item[key]);
                if (!maybe) return '-';
                return maybe[
                    this.$store.state[this.model.schema[key].relation].display];
            }
            return this.item[key] || '--';
        },
    },
});
</script>

<template lang='pug'>
    v-expansion-panels(v-if='item' v-model='toggle_' focusable)
        v-expansion-panel
            v-expansion-panel-header
                span.subheading.font-weight-bold {{ item[model.display] }}
            v-expansion-panel-content
                v-list(dense)
                    v-list-item(v-for='(key) in keys' :key="key+'_viewcard'")
                        v-list-item-content {{ $t(key) }}:
                        v-list-item-content.align-end {{ getContent(key) }}
                    v-card-actions.card-action
                        v-btn-toggle(dark mandatory)
                            v-btn(v-if='panel' color='blue' fab small @click='$router.push({name:"panel",params:{_id:item._id,_model:model}})')
                                v-icon(dark) mdi-door-open
</template>

<style lang='scss'>
.subheading {
    cursor: pointer;
    user-select: none;
}

.card-action {
    flex-direction: row-reverse;
}

.post-card {
    max-height: 600px;
    overflow: scroll;
}
</style>
