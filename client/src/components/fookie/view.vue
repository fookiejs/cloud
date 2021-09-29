<script>
import lodash from "lodash";
import Vue from "vue";

export default Vue.extend({
  props: ["model", "query", "post", "remove", "patch", "panel"],
  data() {
    return {
      viewToggle: 1,
      search: "",
      filter: {},
      sortDesc: false,
      page: 1,
      itemsPerPage: 4,
    };
  },
  computed: {
    items() {
      let pool = this.pool(this.model.name);
      if (this.query) {
        pool = lodash.filter(pool, this.query);
      }
      if (this.search !== "") {
        pool = pool.filter((f) => JSON.stringify(f).includes(this.search));
      }
      console.info(pool);
      return pool;
    },
    keys() {
      return ["_id"].concat(Object.keys(this.model.schema))
    },
    headers() {
      return this.keys.map((x) => ({
        text: this.$t(x),
        value: x,
        sortable: true,
        align: "start",
        width: 100,
      }));
    },
  },
  methods: {
    async getApi() {
      if (
        ![
          "company",
          "system_menu_type",
          "system_menu",
          "system_submenu",
        ].includes(this.model)
      )
        await this.$store.dispatch("api", {
          model: this.model.name,
          method: "getAll",
        });
      let models = Object.keys(model.schema)
        .filter((key) =>
          lodash.has(this.model.schema[key], "relation")
        )
        .map((field) => this.model.schema[field].relation);
      for (let model of models) {
        await this.$store.dispatch("api", {
          model:model.name,
          method: "getAll",
        });
      }
    },
  },
  mounted() {
    this.getApi().then();
  },
  watch: {
    companyId() {
      this.getApi().then();
    },
  },
});
</script>

<template lang='pug'>
div
  v-toolbar.mb-6
    v-toolbar-title {{ $t(model.name) }}
    v-spacer
    v-spacer
    v-spacer
    v-spacer
    v-text-field(
      v-model="search",
      clearable,
      hide-details,
      prepend-inner-icon="mdi-magnify",
      outlined,
      dense,
      class
    )
    v-btn-toggle(v-model="viewToggle", mandatory, dense)
      v-btn
        v-icon mdi-table-large
      v-btn.mr-3
        v-icon mdi-format-list-bulleted
    fookie-post(v-if="post", :model="model")
  v-data-iterator(
    v-if="!viewToggle",
    :items="items",
    :items-per-page.sync="itemsPerPage",
    :page.sync="page",
    :search="search",
    :sort-desc="sortDesc",
    disable-pagination,
    hide-default-footer,
    no-data-text="İçerik bulunamadı",
    no-results-text="Aramanızla eşleşen içerik yok",
    sort-by="createdAt"
  )
    template(v-slot:default="props")
      v-container
        v-row
          v-col(
            v-for="item in props.items",
            :key="item._id + '_viewitem'",
            cols="12",
            md="3",
            sm="6"
          )
            v-card(color="post-card")
              v-card-title
                v-tooltip(bottom)
                  template(v-slot:activator="{ on, attrs }")
                    span(v-bind="attrs", v-on="on") {{ item[model.display] }}
                  span {{ item[model.display] }}
              v-divider
              v-card-text.card-container
                v-list(dense)
                  v-list-item(
                    v-for="key in keys.filter((x) => !['password', '_id'].includes(x))",
                    :key="key + '_viewcard'"
                  )
                    v-list-item-content {{ $t(key) }}:
                    v-list-item-content.align-end
                      fookie-field(:model="model", :item="item", :field="key")
              v-card-actions.card-action
                v-btn-toggle(dark, mandatory)
                  v-btn(
                    v-if="panel",
                    color="blue",
                    fab,
                    small,
                    @click="$router.push({ name: 'panel', params: { _id: item._id, _model: model.name } })"
                  )
                    v-icon(dark) mdi-door-open
                  fookie-post(
                    v-if="patch",
                    :model="model",
                    :selectedId="item._id"
                  )

                  fookie-delete(
                    v-if="remove",
                    :model="model",
                    :selectedId="item._id"
                  )

  v-simple-table(v-else, :headers="headers", :items="items")
    thead
      tr
        th.text-no-wrap(
          v-for="key in keys.filter((x) => x !== '_id').concat(['actions'])",
          :key="'simpetablehead_' + key"
        ) {{ $t(key) }}
    tbody
      tr(v-for="item in items", :key="'simpetablehead_' + item._id")
        th.text-no-wrap(
          v-for="key in keys.filter((x) => x !== '_id')",
          :key="'simpletbodyth' + key"
        )
          fookie-field(:model="model", :item="item", :field="key")
        th
          v-btn-toggle(dark, mandatory)
            v-btn(
              v-if="panel",
              color="blue",
              fab,
              small,
              @click="$router.push({ name: 'panel', params: { _id: item._id, _model: model } })"
            )
              v-icon(dark) mdi-door-open
            fookie-post(v-if="patch", :model="model", :selectedId="item._id")
            fookie-delete(
              v-if="remove",
              :model="model",
              :selectedId="item._id"
            )
</template>

<style lang='scss'>
.card-action {
  flex-direction: row-reverse;
}

.post-card {
  max-height: 600px;
  overflow: scroll;
}

.card-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-container {
  max-height: 350px;
  overflow-y: scroll;
}
</style>
