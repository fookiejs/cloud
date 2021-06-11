<template>
    <v-dialog v-model="dialog" elevation="3" width="700">
        <template v-slot:activator="{ on, attrs }">
            <v-btn
                v-if="!selectedId"
                v-bind="attrs"
                v-on="on"
                color="green"
                dark
                fab
                small
            >
                <v-icon>mdi-plus</v-icon>
            </v-btn>
            <v-btn
                v-if="selectedId"
                v-bind="attrs"
                v-on="on"
                color="yellow darken-1"
                dark
                fab
            >
                <v-icon>mdi-pencil</v-icon>
            </v-btn>
        </template>
        <v-card>
            <v-card-title> Create {{ model.name }}</v-card-title>
            <v-card-text> </v-card-text>
            <v-card-text v-for="(field, i) in fields" :key="i + 'postfiledi_'">
                <v-text-field
                    v-if="field.input == 'text'"
                    v-model="body[i]"
                    :label="i"
                    prepend-icon="mdi-text"
                ></v-text-field>

                <v-text-field
                    v-if="field.input == 'password'"
                    v-model="body[i]"
                    :append-icon="menus[i] ? 'mdi-eye' : 'mdi-eye-off'"
                    :label="i"
                    hint="At least 8 characters"
                    prepend-icon="mdi-lock"
                    type="password"
                    @click:append="menus[i] = !menus[i]"
                ></v-text-field>

                <v-text-field
                    v-if="field.input == 'number'"
                    v-model="body[i]"
                    :label="i"
                    prepend-icon="mdi-numeric"
                    type="number"
                ></v-text-field>

                <v-select
                    prepend-icon="mdi-gender-male-female"
                    v-if="field.input == 'gender'"
                    v-model="body[i]"
                    :items="['male', 'female']"
                    :label="i"
                ></v-select>

                <v-text-field
                    v-if="field.input == 'file'"
                    v-model="body[i]"
                    :label="i"
                    prepend-icon="mdi-file"
                    type="file"
                ></v-text-field>

                <v-text-field
                    v-if="field.input == 'time'"
                    v-model="body[i]"
                    :label="i"
                    prepend-icon="mdi-clock-time-four-outline"
                    type="time"
                ></v-text-field>

                <v-text-field
                    v-if="field.input == 'color'"
                    v-model="body[i]"
                    :background-color="body[i] ? body[i].hexa : ''"
                    :label="i"
                    prepend-icon="mdi-calendar"
                    type="color"
                ></v-text-field>

                <v-text-field
                    v-if="field.input == 'date'"
                    v-model="body[i]"
                    :label="i"
                    prepend-icon="mdi-calendar"
                    type="date"
                ></v-text-field>

                <v-textarea
                    prepend-icon="mdi-text"
                    v-if="field.input == 'rich'"
                    :label="i"
                ></v-textarea>

                <div v-if="field.input == 'json'">{{ i }}</div>
                <v-jsoneditor
                    v-if="field.input == 'json'"
                    v-model="body[i]"
                    :options="{
                        mode: 'code',
                        mainMenuBar: false,
                        statusBar: false,
                    }"
                    :plus="false"
                    height="200px"
                />

                <v-switch
                    v-if="field.input == 'boolean'"
                    v-model="body[i]"
                    :label="i"
                    inset
                ></v-switch>

                <v-autocomplete
                    v-if="typeof field.relation == 'string'"
                    v-model="body[i]"
                    :item-text="relationModel(field.relation).display"
                    :items="relationModel(field.relation).pool"
                    :label="i"
                    :loading="loadings[i]"
                    :search-input.sync="search[i]"
                    clearable
                    item-value="_id"
                    prepend-icon="mdi-relation-one-to-one"
                ></v-autocomplete>
                <v-text-field
                    v-if="field.input == 'phone'"
                    v-model="body[i]"
                    v-mask="'+90 (###) ###-####'"
                    :label="i"
                    prepend-icon="mdi-phone"
                ></v-text-field>
            </v-card-text>
            <v-card-actions class="card-action">
                <v-btn
                    v-if="!selectedId"
                    color="success darken-1 "
                    text
                    @click="create"
                    >Kaydet
                </v-btn>
                <v-btn
                    v-if="selectedId"
                    color="yellow darken-1"
                    text
                    @click="edit"
                    >Güncelle
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>


<script>
import deepmerge from "deepmerge";

export default {
    props: ["defaults", "model", "selectedId"],
    data() {
        return {
            search: {},
            loadings: {},
            syncs: {},
            menus: {},
            body: {},
            constBody: {},
            patchBody: {},
            dialog: false,
        };
    },
    computed: {
        fields() {
            if (typeof this.defaults == "object") {
                let keys = Object.keys(this.model.schema);
                let defaultKeys = Object.keys(this.defaults);
                keys = keys.filter((k) => !defaultKeys.includes(k));
                let res = {};
                for (let key of keys) {
                    res[key] = this.model.schema[key];
                }
                return res;
            } else {
                return this.model.schema;
            }
        },
    },
    mounted: async function () {
        if (this.selectedId) {
            this.body = this.model.pool.find((m) => m._id == this.selectedId);
            console.log(this.body);
        }

        if (typeof this.defaults == "object") {
            this.body = deepmerge(this.body, this.defaults);
        }
        this.constBody = JSON.parse(JSON.stringify(this.body));
    },
    methods: {
        relationModel(model) {
            return this.$store.state[model];
        },
        create: async function () {
            this.dialog = false;
            let body = this.body;
            let model = this.model.name;
            // string to number parser
            for (let key of Object.keys(body)) {
                if (
                    ["integer", "number", "float"].includes(
                        this.model.schema[key].type
                    )
                ) {
                    body[key] = parseInt(body[key]);
                }
            }

            await this.$store.dispatch("api", {
                method: "post",
                model,
                body,
            });
        },
        edit: async function () {
            this.dialog = false;
            let body = this.patchBody;
            let model = this.model.name;
            let _id = this.selectedId;
            // string to number parser
            for (let key of Object.keys(body)) {
                if (
                    ["integer", "number", "float"].includes(
                        this.model.schema[key].type
                    )
                ) {
                    body[key] = parseInt(body[key]);
                }
            }

            await this.$store.dispatch("api", {
                method: "patch",
                model,
                body,
                query: {
                    where: {
                        _id,
                    },
                },
            });
        },
    },
    watch: {
        body: {
            deep: true,
            handler(body) {
                let keys = Object.keys(this.body);
                for (let key of keys) {
                    if (
                        JSON.stringify(this.constBody[key]) !=
                        JSON.stringify(body[key])
                    ) {
                        this.patchBody[key] = body[key];
                    } else {
                        delete this.patchBody[key];
                    }
                }
            },
        },
    },
    search: {
        deep: true,
        handler(newVal, oldVal) {
            let keys = Object.keys(newVal);
            for (let key of keys) {
                if (newVal[key] != oldVal[key]) {
                    console.info(key);
                }
            }
        },
    },
};
</script>

<style lang='scss'>
.ql-editor {
    min-height: 300px;
}

.card-action {
    flex-direction: row-reverse;
}
</style>