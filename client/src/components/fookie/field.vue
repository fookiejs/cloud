<script>
import Vue from 'vue';

export default Vue.extend({
    props: ['item', 'field', 'model'],
    computed: {
        getRelation() {
            let model = this.$store.state[this.getModel(this.model).schema[this.field].relation];
            let data = model.pool.find((x) => x._id === this.item[this.field]);
            if (data) return data[model.display];
            return '-';
        },
    },
});
</script>

<template lang='pug'>
    div
        div(v-if='model.schema[field] && model.schema[field]["relation"]')
            v-tooltip(bottom color='transparent')
                template(v-slot:activator='{ on, attrs }')
                    span(v-bind='attrs' v-on='on') {{getRelation}}
                fookie-card(:model="$store.state[model.schema[field].relation]" :toggle='0' :patch='true' :selectedId="item[field]")

        span(v-else-if='model.schema[field] && model.schema[field]["input"]==="phone"')
            | {{item[field] | VMask('+90 (###) ###-####')}}

        span(v-else-if='model.schema[field] && model.schema[field]["input"]==="map"')
            v-tooltip(top)
                template( v-slot:activator="{ on, attrs }")
                    v-icon(  v-bind="attrs" v-on="on") mdi-map-marker
                span {{item[field]}}
                l-map( :center='item[field] ' :zoom='17' style='height: 20em;' )
                    l-tile-layer(url='https://{s}.tile.osm.org/{z}/{x}/{y}.png')


        v-btn(target='_blank' small :href='item[field]'
            v-else-if='model.schema[field] && model.schema[field]["input"]==="file" && item[field]')
            v-icon(dense small) mdi-eye
            span {{$t('openFile')}}

        span(v-else) {{item[field]}}

</template>
