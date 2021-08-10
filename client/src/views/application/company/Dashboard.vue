<script>
import Vue from 'vue';

export default Vue.extend({
    mounted: async function() {
        this.$store.state.selectedCompany = this.$route.params.company;
        await this.$store.dispatch('api', {
            model: 'school',
            method: 'get',
        });
        await this.$store.dispatch('api', {
            model: 'student',
            method: 'get',
        });
        await this.$store.dispatch('api', {
            model: 'vehicle',
            method: 'get',
        });
        await this.$store.dispatch('api', {
            model: 'driver',
            method: 'get',
        });
    },
    data() {
        return {
            company: null,
            type: 'month',
            types: ['month', 'week', 'day', '4day'],
            mode: 'stack',
            modes: ['stack', 'column'],
            weekday: [1, 2, 3, 4, 5, 6, 0],
            value: '',
            events: [],
            colors: ['blue', 'indigo', 'deep-purple', 'cyan', 'green', 'orange', 'grey darken-1'],
            names: ['Meeting', 'Holiday', 'PTO', 'Travel', 'Event', 'Birthday', 'Conference', 'Party'],
        };
    },
    computed: {
        model() {
            return this.$store.state.company;
        },
    },
});
</script>

<template lang='pug'>
    .space-y-2
        v-toolbar(flat color='transparent')
            v-toolbar-title {{($store.state.company.pool.find(x=>x._id===$route.params.company)||{name:''}).name}}
            v-spacer
            fookie-panel(v-if='model.panel.includes("admin") || true' model='company' :selected-id='$route.params.company')
        v-row
            v-col
                v-card.mx-auto(max-width='400')
                    v-list-item(two-line='')
                        v-list-item-content
                            v-list-item-title.text-h5 {{$t('total')}}   {{$t('school')}}
                    v-card-text.text-h2 {{$store.state.school.pool.length}}
            v-col
                v-card.mx-auto(max-width='400')
                    v-list-item(two-line='')
                        v-list-item-content
                            v-list-item-title.text-h5 {{$t('total')}}   {{$t('student')}}
                    v-card-text.text-h2 {{$store.state.student.pool.length}}
            v-col
                v-card.mx-auto(max-width='400')
                    v-list-item(two-line='')
                        v-list-item-content
                            v-list-item-title.text-h5 {{$t('total')}}   {{$t('driver')}}
                    v-card-text.text-h2  {{$store.state.driver.pool.length}}
            v-col
                v-card.mx-auto(max-width='400')
                    v-list-item(two-line='')
                        v-list-item-content
                            v-list-item-title.text-h5 {{$t('total')}}   {{$t('vehicle')}}
                    v-card-text.text-h2  {{$store.state.vehicle.pool.length}}
        v-row
            v-col(cols='12')
                company-contract(:latlong1= '0' latlong2='2' price-per-km='32')
</template>
