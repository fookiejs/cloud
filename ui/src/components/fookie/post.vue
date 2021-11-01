<template lang="pug">
div 
  v-card
    v-card-title Create {{ model.name }}
    v-card-text(v-for="(field, i) in fields", :key="i + 'postfiledi_'")
      pre(v-if="typeof field.relation == 'string'") {{ relationModel(field.relation).display }}
      v-text-field(
        v-if="field.input == 'text'",
        v-model="body[i]",
        :label="i",
        prepend-icon="mdi-text"
      )
      v-text-field(
        v-if="field.input == 'password'",
        v-model="body[i]",
        :append-icon="menus[i] ? 'mdi-eye' : 'mdi-eye-off'",
        :label="i",
        hint="At least 8 characters",
        prepend-icon="mdi-lock",
        type="password",
        @click:append="menus[i] = !menus[i]"
      )
      v-text-field(
        v-if="field.input == 'number'",
        v-model="body[i]",
        :label="i",
        prepend-icon="mdi-numeric",
        type="number"
      )
      v-select(
        prepend-icon="mdi-gender-male-female",
        v-if="field.input == 'gender'",
        v-model="body[i]",
        :items="['male', 'female']",
        :label="i"
      )
      v-text-field(
        v-if="field.input == 'file'",
        v-model="body[i]",
        :label="i",
        prepend-icon="mdi-file",
        type="file"
      )
      v-text-field(
        v-if="field.input == 'time'",
        v-model="body[i]",
        :label="i",
        prepend-icon="mdi-clock-time-four-outline",
        type="time"
      )
      v-text-field(
        v-if="field.input == 'color'",
        v-model="body[i]",
        :background-color="body[i] ? body[i].hexa : ''",
        :label="i",
        prepend-icon="mdi-calendar",
        type="color"
      )
      v-text-field(
        v-if="field.input == 'date'",
        v-model="body[i]",
        :label="i",
        prepend-icon="mdi-calendar",
        type="date"
      )
      v-textarea(
        prepend-icon="mdi-text",
        v-if="field.input == 'rich'",
        :label="i"
      )
      div(v-if="field.input == 'json'") {{ i }}
        v-switch(
          v-if="field.input == 'boolean'",
          v-model="body[i]",
          :label="i",
          inset
        )
      v-autocomplete(
        v-if="typeof field.relation == 'string'",
        v-model="body[i]",
        :item-text="relationModel(field.relation).display",
        :items="$store.state[field.relation]",
        :label="i",
        :loading="loadings[i]",
        :search-input.sync="search[i]",
        clearable,
        item-value="id",
        prepend-icon="mdi-relation-one-to-one"
      )
      v-text-field(
        v-if="field.input == 'phone'",
        v-model="body[i]",
        v-mask="'+90 (###) ###-####'",
        :label="i",
        prepend-icon="mdi-phone"
      )
    v-card-actions.card-action
      v-btn(
        v-if="!selectedId",
        color="success darken-1 ",
        text,
        @click="create"
      ) Save
      v-btn(v-if="selectedId", color="yellow darken-1", text, @click="edit") Edit
</template>

<script>
import lodash from "lodash";
export default {
  props: ["model", "selectedId"],
  data() {
    return {
      body: {},
      loadings: {},
      search: {},
    };
  },
  methods: {
    relationModel(model) {
      console.info(
        this.$store.state["model"].filter((m) => m.name === model)[0]
      );
      return this.$store.state["model"].filter((m) => m.name === model)[0];
    },
    create() {},
  },
  computed: {
    fields() {
      lodash;
      return this.model.schema;
    },
  },
};
</script>

<style>
</style>