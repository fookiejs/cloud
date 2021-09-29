<script>
import Vue from "vue";
import _ from "lodash";

export default Vue.extend({
  computed: {
    model() {
      return this.$store.state[this.$route.params._model];
    },
    entity() {
      return (
        this.model.pool.find((m) => m._id === this.$route.params._id) || {
          _id: null,
        }
      );
    },
    relation_models() {
      return this.$store.state.model.pool
        .filter((m) =>
          JSON.stringify(this.$store.state[m]).includes(
            `"relation":"${this.model.name}"`
          )
        )
        .map((x) => this.$store.state[x]);
    },
  },
  methods: {
    relation_models_for(model) {
      let defaults = {};
      let maybeRelation = Object.keys(model.schema).find(
        (x) => model.schema[x]["relation"] === this.model.name
      );
      if (maybeRelation) defaults[maybeRelation] = this.entity._id;
      return defaults;
    },
  },
  async mounted() {
    if (
      _.findIndex(this.$store.state[this.model.name].pool, {
        _id: this.$route.params._id,
      }) === -1
    ) {
      await this.$store.dispatch("api", {
        model: this.model.name,
        method: "get",
      });
    }
    let related_fields = this.related_fields(this.model.name);
    for (let model of Object.keys(related_fields)) {
      await this.$store.dispatch("api", {
        model: model,
        method: "get",
        query: { [related_fields[model][0]]: this.$route.params._id },
      });
    }

    if (this.$route.params._model === "company")
      this.$store.state.selectedCompany = this.$route.params._id;
  },
});
</script>

<template lang='pug'>
div
  v-row
    v-col
      .my-3 {{ $t(model.name) }} {{ $t('panel') }}
  v-row
    v-col
      fookie-card(
        :model="$store.state[$route.params._model]",
        :patch="true",
        :selectedId="$route.params._id"
      )
  v-row
    v-col(
      v-for="(relation, i) in relation_models",
      :key="i + '_panelrelation'",
      lg="3",
      md="6",
      sm="12"
    )
      v-card(elevation="0", outlined)
        v-card-title
          span.text-lg {{ $t('new') }} {{ $t(relation.name) }}
          v-spacer
          fookie-post(
            :post="false",
            :key="i + relation.name",
            :defaults="relation_models_for(relation)",
            :model="relation"
          )
  v-row
    v-col
      fookie-relation-tab(:model="model", :selectedId="$route.params._id")
</template>
