<template lang="pug">
v-row
  v-col 
    v-dialog(v-model="dialog", width="500")
        template(v-slot:activator="{ on, attrs }")
            v-btn(color="green", dark, fab, v-bind="attrs", v-on="on")
                v-icon(dark) mdi-plus
        v-card
            v-card-text
                fookie-post(:model="model")
  v-col(
    v-for="entity in $store.state[model.name]",
    :key="entity",
    cols="12",
    md="3",
    sm="6"
  )
    v-card 
      v-card-title {{ entity.name }}
      v-card-text(v-for="key in schema_keys")
        fookie-field(:model="model", :keyName="key", :entity="entity")
      v-card-actions
           
</template>

<script>
import lodash from "lodash";

export default {
  props: ["model"],
  computed: {
    schema_keys() {
      return lodash.keys(this.model.schema);
    },
  },
};
</script>

<style>
</style>