<script>
import Vue from 'vue';
import moment from 'moment';

export default Vue.extend({
  methods: {
    editSelected(val) {
      if (this.selected + val >= 0 && this.selected + val < this.model.pool.length) {
        this.selected += val;
      }
    },
  },
  mounted() {
    this.$store.dispatch("api",{
      model:"vehicle",
      method:"get"
    })
    setInterval(() => {
      if (this.follow) {
       this.$refs.myMap.mapObject.panTo([this.selectedVehicle.position.lat, this.selectedVehicle.position.lng]);
      }
      this.model.pool.forEach((veh) => {
        veh.position.lat += 0.011;
        veh.position.lng += 0.011;
      });
    }, 350);

  },
  computed: {
    pool() {
      let pool = this.model.pool;
      for (let filter of this.filterArray) {
        pool = pool.filter(filter);
      }
      return pool;
    },
    model() {
      return this.$store.state.vehicle;
    },
    selectedVehicle() {
      return this.model.pool[this.selected];
    },
    transports() {
      return this.$store.state.transport.pool;
    },
  },
  data() {
    return {
      application: false,
      selected: 0,
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      zoom: 8,
      center: [38, 32],
      menu: false,
      filterArray: [],
      follow: true,
      transport: false,
      search: '',
    };
  },
  watch: {
    transport: function() {
      this.$store.state.transport.pool.forEach((transport) => {
        let date = moment(transport.start, 'HH:mm').format();
      });
    },
  },
});
</script>

<template lang='pug'>
  div
    l-map(ref='myMap' :center.sync='center' :zoom='10' style='height:80vh ;z-index:0'
      :options='{scrollWheelZoom:false}' )
      l-tile-layer(:url='url')
      l-marker(v-for='vehicle in pool' :key="vehicle._id+'__livevehicleasd'" :lat-lng='vehicle.position')
      l-control(position='topright')
        v-menu(v-model='application' :close-on-content-click='false')
          template(v-slot:activator="{ on, attrs }")
            v-btn(color='yellow darken-2' v-bind="attrs" v-on="on" fab dense dark)
              v-icon() mdi-view-split-horizontal
          live-menu
      l-control.flex.align-center.justify-center.space-x-2(position='bottomleft')
        v-btn(color='blue' dark fab small @click='editSelected(-1)')
          v-icon mdi-menu-left
        v-btn(color='blue' dark fab small @click='editSelected(1)')
          v-icon mdi-menu-right
        v-switch(v-model='follow' label='Takip')
        span(v-if='selectedVehicle') Selected Veh: {{ selectedVehicle.plate }}
        span Index: {{ selected }}
      l-control.m-2.w-80(position='bottomright')
</template>
