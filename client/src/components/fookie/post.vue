<script>
import deepmerge from 'deepmerge';
import Vue from 'vue';
import { request } from '@/util/request';
import axios from 'axios';
import _ from 'lodash';
import { awsLocation } from '@/util/location';

export default Vue.extend({
  props: ['defaults', 'model', 'selectedId', 'value'],
  data() {
    return {
      password: false,
      disable: false,
      valid: false,
      search: {},
      loadings: {},
      syncs: {},
      menus: {},
      body: {},
      constBody: {},
      patchBody: {},
      dialog: false,
      sended: false,
      url: 'https://{s}.tile.osm.org/{z}/{x}/{y}.png',
    };
  },
  computed: {
    fields() {
      let res = _.cloneDeep(this.model.schema);
      let keys = Object.keys(this.model.schema);
      if (this.defaults) {
        let defaultKeys = Object.keys(this.defaults);
        keys = keys.filter(k => !defaultKeys.includes(k));
        res = _.pick(res, keys);
      }

      return res;
    },
  },
  mounted: async function() {
    this.body = {};
    if (this.selectedId) {
      this.body = this.model.pool.find((m) => m._id === this.selectedId);
    }
    if (typeof this.defaults == 'object') {

      this.body = deepmerge(this.body, this.defaults);
    }
    this.constBody = JSON.parse(JSON.stringify(this.body));
  },
  methods: {
    hidePw(i) {
      this.menus[i] = !this.menus[i];
    },
    parseRule(field) {
      let rules = this.$store.state.rules;
      let arr = [];
      //todo: burası
      if (field.hasOwnProperty('required')) arr.push(rules.required(field));
      if (field.hasOwnProperty('maxSize')) arr.push(rules.maxSize(field));
      if (field.hasOwnProperty('min')) arr.push(rules.min(field));
      if (field.hasOwnProperty('max')) arr.push(rules.max(field));
      if (field.hasOwnProperty('equal')) arr.push(rules.equal(field));
      return arr;
    },
    relationModel(model) {
      return this.$store.state[model];

    },
    relationItems(field, body) {
      let pool = this.relationModel(field.relation).pool;
      if (field.hasOwnProperty('filterBy')) {
        if (body[field.filterBy]) {
          pool = _.filter(pool, { [field.filterBy]: body[field.filterBy] });
        }

      }
      return pool;
    },
    create: async function() {
      this.disable = true;
      let valid = true;
      for (let comp of this.$refs['form_' + this.model.name]) {
        valid = valid && comp.validate();
      }
      if (!valid) return false;

      let body = !this.selectedId ? this.body : this.patchBody;
      let model = this.model.name;


      let patch = {};
      if (!!this.selectedId) patch = {
        path: [this.selectedId],
      };
      await this.$store.dispatch('api', {
        method: !this.selectedId ? 'post' : 'patch',
        model,
        body,
        ...patch,
      });
      this.disable = false;
      this.dialog = false;
    },
    getAddress: async function(Text, field) {
      if (!field['address']) return;
      try {
        const loc = await awsLocation();
        let { Results, Summary } = await loc.searchPlaceIndexForText({
          IndexName: 'servisizle_geo',
          Text,
        }).promise();
        this.$refs.mymapPost[0].mapObject.panTo(Results[0].Place.Geometry.Point, { animate: true });
        this.$refs.mymapPost[0].mapObject.fitBounds(_.chunk(Summary.ResultBBox.reverse(), 2));
      } catch (e) {
      }
    },
  },
  watch: {
    body: {
      deep: true,
      handler(body) {
        let keys = Object.keys(this.body);
        for (let key of keys) {
          if (JSON.stringify(this.constBody[key]) !== JSON.stringify(body[key])) {
            this.patchBody[key] = body[key];
          } else {
            delete this.patchBody[key];
          }
        }
      },
    },
    search: {
      deep: true,
      handler(newVal, oldVal) {
        let keys = Object.keys(newVal);
        for (let key of keys) {
          if (newVal[key] !== oldVal[key]) {
          }
        }
      },
    },
    dialog(val) {
      if (val) {
        this.disable = false;
        //this.body = {};
        this.sended = false;
      }
      if (!val) {
        if (this.sended) {
          this.body = this.constBody;
          this.patchBody = this.constBody;
        }
      }
      setTimeout(() => {
        if (this.$refs.mymapPost[0]) this.$refs.mymapPost[0].mapObject.invalidateSize();
      }, 300);
    },
  },
});
</script>

<template lang='pug'>
  v-dialog(v-model='dialog' elevation='3' width='700')
    template(v-slot:activator='{ on, attrs }')
      v-btn(v-bind='attrs' v-on='on' :color='selectedId ? "yellow darken-1":"green"' dark fab small)
        v-icon {{ selectedId ? 'mdi-pencil' : 'mdi-plus' }}
    v-card
      v-card-title  {{ $t('new') }} {{ $t(model.name) }}
      v-card-text(v-for='(field, i) in fields' :key="i+'postfiledi_'")
        v-form(v-model='valid' :ref="'form_'+model.name")
          v-text-field(v-if="field.input === 'text'" v-model='body[i]' :label='$t(i)' prepend-icon='mdi-text' :rules='parseRule(field)')
          span {{menus[i]}}
          v-text-field(
            v-if="field.input === 'password'"
            v-model='body[i]'
            :append-icon="password ? 'mdi-eye' : 'mdi-eye-off'"
            :type="password ? 'text' : 'password'"
            :label='$t(i)'
            hint='En az 6 karakter olmalıdır.'
            prepend-icon='mdi-lock'
            @click:append='password = !password'
            :rules='parseRule(field)')

          v-text-field(v-if="field.input === 'number'" :rules='parseRule(field)' v-model='body[i]'   :label='$t(i)' prepend-icon='mdi-numeric' type='number')

          v-select(prepend-icon='mdi-gender-male-female' :rules='parseRule(field)' v-if="field.input === 'gender'" v-model='body[i]' :items="['Erkek','Kadın']" :label='$t(i)')

          v-select(prepend-icon='mdi-gender-male-female' :rules='parseRule(field)'
            v-if="field.input === 'blood'" v-model='body[i]'
            :items="['A RH -','B RH -','AB RH -','0 RH -','A RH +','B RH +','AB RH +','0 RH +']"
            :label='$t(i)')

          v-select(prepend-icon='mdi-shape' :rules='parseRule(field)'
            v-if="field.input === 'select'" v-model='body[i]' :items="field.options" :label='$t(i)')


          v-file-input(v-if="field.input === 'file'" :rules='parseRule(field)' v-model='body[i]'
            :label='$t(i)' show-size)

          v-slider(v-if="field.input === 'percent'" v-model="body[i]" :label='$t(i)' :min='field.min' :max='field.max' thumb-label)

          v-text-field(v-if="field.input === 'time'" :rules='parseRule(field)' v-model='body[i]' :label='$t(i)' prepend-icon='mdi-clock-time-four-outline' type='time')

          v-text-field(v-if="field.input === 'color'" :rules='parseRule(field)' v-model='body[i]' :background-color="body[i] ? body[i].hexa : ''" :label='$t(i)' prepend-icon='mdi-calendar' type='color')

          v-text-field(v-if="field.input === 'date'" :rules='parseRule(field)' v-model='body[i]' :label='$t(i)' prepend-icon='mdi-calendar' type='date')

          v-range-slider(v-if="field.input === 'range-slider'" v-model='body[i]' :label='$t(i)' thumb-label :min='0' :max='60'  prepend-icon='mdi-arrow-left-right')

          v-textarea( v-if="field.input === 'rich'" :label='$t(i)' prepend-icon='mdi-text'  mdi-text :rules='parseRule(field)' v-model='body[i]')

          v-textarea(prepend-icon='mdi-text' :rules='parseRule(field)' v-model='body[i]'
            v-if="field.input === 'address'" :label='$t(i)' append-icon='mdi-target'  @click:append='getAddress(body[i],field)')

          div(v-if="field.input === 'json'") {{ $t(i) }}

          v-jsoneditor(v-if="field.input === 'json'" v-model='body[i]' :options="{ mode: 'code',mainMenuBar:false ,statusBar:false}" :plus='false' height='200px')

          v-switch(v-if="field.input === 'boolean'" :rules='parseRule(field)' v-model='body[i]' :label='$t(i)' inset)

          v-autocomplete(v-if="typeof field.relation == 'string'"
            :rules='parseRule(field)'
            v-model='body[i]'
            :item-text='relationModel(field.relation).display'
            :items='relationItems(field,body)'
            :label='$t(i)'
            :loading='$store.state[field.relation].loading'
            :search-input.sync='search[i]'
            clearable
            item-value='_id'
            prepend-icon='mdi-relation-one-to-one'
          )

          v-text-field(v-if="field.input === 'phone'" :rules='parseRule(field)' v-model='body[i]' v-mask="'+90 (###) ###-####'" :label='$t(i)' prepend-icon='mdi-phone')

          div.mapClass(v-if="field.input==='map'")
            v-icon.mapMarker(size='32' ) mdi-map-marker
            l-map(ref="mymapPost" :center.sync='body[i] ' :zoom='20'
              :options='{scrollWheelZoom:false}'
              style='height: 30vh;' )
              l-tile-layer(:url='url')
          div(v-if='field.description' class='italic text-xs') *{{field.description}}
      v-card-actions.card-action
        v-btn(v-if='!selectedId' color='success darken-1 ' text @click='create' :disabled='disable') {{$t('save')}}
        v-btn(v-if='selectedId' color='yellow darken-1' text @click='create' :disabled='disable') {{$t('update')}}
</template>

<style lang='scss'>
.card-action {
  flex-direction: row-reverse;
}

.mapClass {
  position: relative;

  .mapMarker {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, calc(-100%));
    z-index: 999999999999;
  }
}
</style>
