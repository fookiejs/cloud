<script>
import Vue from 'vue';

export default Vue.extend({
    props: ['model', 'selectedId'],
    methods: {
        fieldsToQuery(fields, val) {
            let res = {};
            for (let f of fields) {
                res[f] = val;
            }
            return res;
        },
    },
    computed: {
        models() {
            let res = {};
            this.$store.state.model.pool.forEach((model) => {
                let schemaKeys = Object.keys(this.$store.state[model].schema);
                for (let field of schemaKeys) {
                    if (JSON.stringify(this.$store.state[model].schema[field]).includes(`"relation":"${this.model.name}"`)) {
                        if (!res[model]) {
                            res[model] = [];
                        }
                        res[model].push(field);
                    }
                }
            });
            return res;
        },
    },
});
</script>

<template lang='pug'>
    v-tabs
        v-tab
            v-icon mdi-eye-off-outline
        v-tab(v-for='(obj,modelName) in models' :key="modelName +'_rltabviewtab'") {{ $t(modelName) }}
        v-tab-item
        v-tab-item(v-for='(obj,modelName) in models' :key="modelName +'_rltabbbview'")
            fookie-viewer(:panel='true' :remove='true' :patch='true' :post='false' :model='$store.state[modelName]' :query='fieldsToQuery(obj,selectedId)')
</template>
